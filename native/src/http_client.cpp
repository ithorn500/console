#include "console/http_client.hpp"

#include <arpa/inet.h>
#include <fcntl.h>
#include <netdb.h>
#include <sys/poll.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cctype>
#include <cstring>
#include <sstream>
#include <string_view>

namespace amber::console {

namespace {
constexpr std::size_t kMaxResponseBytes = 16 * 1024 * 1024;
}

bool parse_http_url(const std::string& url, ParsedUrl& out, std::string& error) {
  const std::string prefix = "http://";
  if (url.rfind(prefix, 0) != 0) {
    error = "only http:// owner endpoints are supported in release 1";
    return false;
  }
  std::string rest = url.substr(prefix.size());
  auto slash = rest.find('/');
  std::string authority = slash == std::string::npos ? rest : rest.substr(0, slash);
  out.target = slash == std::string::npos ? "/" : rest.substr(slash);
  auto colon = authority.rfind(':');
  if (colon == std::string::npos) {
    out.host = authority;
    out.port = "80";
  } else {
    out.host = authority.substr(0, colon);
    out.port = authority.substr(colon + 1);
  }
  if (out.host.empty() || out.port.empty()) {
    error = "invalid http url";
    return false;
  }
  return true;
}

static bool wait_fd(int fd, short events, std::chrono::milliseconds timeout) {
  pollfd pfd{};
  pfd.fd = fd;
  pfd.events = events;
  return poll(&pfd, 1, static_cast<int>(timeout.count())) > 0 && (pfd.revents & events);
}

static bool connect_with_timeout(int fd, const sockaddr* addr, socklen_t addrlen, std::chrono::milliseconds timeout, std::string& error) {
  int flags = fcntl(fd, F_GETFL, 0);
  if (flags < 0) {
    error = std::strerror(errno);
    return false;
  }
  if (fcntl(fd, F_SETFL, flags | O_NONBLOCK) < 0) {
    error = std::strerror(errno);
    return false;
  }
  int rc = connect(fd, addr, addrlen);
  if (rc == 0) {
    (void)fcntl(fd, F_SETFL, flags);
    return true;
  }
  if (errno != EINPROGRESS) {
    error = std::strerror(errno);
    return false;
  }
  if (!wait_fd(fd, POLLOUT, timeout)) {
    error = "connect timed out";
    return false;
  }
  int socket_error = 0;
  socklen_t len = sizeof(socket_error);
  if (getsockopt(fd, SOL_SOCKET, SO_ERROR, &socket_error, &len) < 0 || socket_error != 0) {
    error = socket_error ? std::strerror(socket_error) : std::strerror(errno);
    return false;
  }
  (void)fcntl(fd, F_SETFL, flags);
  return true;
}

static HttpResponse http_request(const std::string& method,
                                 const std::string& url,
                                 const std::string& body,
                                 const std::string& content_type,
                                 std::chrono::milliseconds timeout,
                                 std::size_t max_response_bytes = kMaxResponseBytes,
                                 bool overall_deadline = false) {
  auto started = std::chrono::steady_clock::now();
  HttpResponse result;
  ParsedUrl parsed;
  if (!parse_http_url(url, parsed, result.error)) return result;

  addrinfo hints{};
  hints.ai_socktype = SOCK_STREAM;
  hints.ai_family = AF_UNSPEC;
  addrinfo* addrs = nullptr;
  int gai = getaddrinfo(parsed.host.c_str(), parsed.port.c_str(), &hints, &addrs);
  if (gai != 0) {
    result.error = gai_strerror(gai);
    return result;
  }

  int fd = -1;
  for (addrinfo* it = addrs; it; it = it->ai_next) {
    fd = socket(it->ai_family, it->ai_socktype, it->ai_protocol);
    if (fd < 0) continue;
    if (connect_with_timeout(fd, it->ai_addr, it->ai_addrlen, timeout, result.error)) break;
    close(fd);
    fd = -1;
  }
  freeaddrinfo(addrs);
  if (fd < 0) {
    result.error = "connect failed";
    return result;
  }

  timeval tv{};
  tv.tv_sec = static_cast<int>(timeout.count() / 1000);
  tv.tv_usec = static_cast<int>((timeout.count() % 1000) * 1000);
  setsockopt(fd, SOL_SOCKET, SO_RCVTIMEO, &tv, sizeof(tv));
  setsockopt(fd, SOL_SOCKET, SO_SNDTIMEO, &tv, sizeof(tv));

  std::ostringstream request;
  request << method << " " << parsed.target << " HTTP/1.1\r\n"
          << "Host: " << parsed.host << "\r\n"
          << "User-Agent: amber-console/0.1\r\n"
          << "Accept: application/json,text/plain,*/*\r\n";
  if (!body.empty() || method == "POST") {
    request << "Content-Type: " << (content_type.empty() ? "application/json" : content_type) << "\r\n"
            << "Content-Length: " << body.size() << "\r\n";
  }
  request << "\r\n" << body;
  std::string data = request.str();
  ssize_t sent = send(fd, data.data(), data.size(), 0);
  if (sent < 0) {
    result.error = std::strerror(errno);
    close(fd);
    return result;
  }

  std::string raw;
  char buffer[8192];
  while (true) {
    auto wait_timeout = timeout;
    if (overall_deadline) {
      auto elapsed = std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::steady_clock::now() - started);
      if (elapsed >= timeout) break;
      wait_timeout = timeout - elapsed;
    }
    if (!wait_fd(fd, POLLIN, wait_timeout)) break;
    ssize_t n = recv(fd, buffer, sizeof(buffer), 0);
    if (n <= 0) break;
    raw.append(buffer, static_cast<std::size_t>(n));
    auto header_end = raw.find("\r\n\r\n");
    if (header_end != std::string::npos) {
      std::string header = raw.substr(0, header_end);
      std::string header_lower = header;
      for (char& ch : header_lower) ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
      auto body_size = raw.size() - (header_end + 4);
      const std::string_view content_length_key = "content-length:";
      auto content_length_pos = header_lower.find(content_length_key);
      if (content_length_pos != std::string::npos) {
        auto value_start = content_length_pos + content_length_key.size();
        auto value_end = header_lower.find("\r\n", value_start);
        std::string value = header_lower.substr(value_start, value_end == std::string::npos ? std::string::npos : value_end - value_start);
        try {
          auto expected = static_cast<std::size_t>(std::stoull(value));
          if (body_size >= expected) break;
        } catch (...) {
        }
      }
      if (header_lower.find("transfer-encoding: chunked") != std::string::npos &&
          raw.find("\r\n0\r\n", header_end + 4) != std::string::npos) {
        break;
      }
    }
    if (raw.size() > max_response_bytes) break;
  }
  close(fd);

  auto header_end = raw.find("\r\n\r\n");
  std::string header = header_end == std::string::npos ? raw : raw.substr(0, header_end);
  result.body = header_end == std::string::npos ? "" : raw.substr(header_end + 4);
  std::string header_lower = header;
  for (char& ch : header_lower) ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
  if (header_lower.find("transfer-encoding: chunked") != std::string::npos) {
    std::string decoded;
    std::size_t pos = 0;
    while (pos < result.body.size()) {
      auto line_end = result.body.find("\r\n", pos);
      if (line_end == std::string::npos) break;
      std::string size_text = result.body.substr(pos, line_end - pos);
      auto extension = size_text.find(';');
      if (extension != std::string::npos) size_text = size_text.substr(0, extension);
      std::size_t chunk_size = 0;
      try {
        chunk_size = static_cast<std::size_t>(std::stoull(size_text, nullptr, 16));
      } catch (...) {
        break;
      }
      pos = line_end + 2;
      if (chunk_size == 0) break;
      if (pos + chunk_size > result.body.size()) break;
      decoded.append(result.body, pos, chunk_size);
      pos += chunk_size;
      if (result.body.compare(pos, 2, "\r\n") == 0) pos += 2;
    }
    if (!decoded.empty()) result.body = std::move(decoded);
  }
  std::istringstream hs(header);
  std::string http_version;
  hs >> http_version >> result.status;
  result.ok = result.status >= 200 && result.status < 300 && !result.body.empty();
  if (!result.ok && result.error.empty()) result.error = "http status " + std::to_string(result.status);
  result.duration_ms = std::chrono::duration_cast<std::chrono::milliseconds>(
                           std::chrono::steady_clock::now() - started)
                           .count();
  return result;
}

HttpResponse http_get(const std::string& url, std::chrono::milliseconds timeout) {
  return http_request("GET", url, "", "", timeout);
}

HttpResponse http_get_fragment(const std::string& url, std::chrono::milliseconds timeout, std::size_t max_response_bytes) {
  return http_request("GET", url, "", "", timeout, max_response_bytes, true);
}

HttpResponse http_post_json(const std::string& url, const std::string& body, std::chrono::milliseconds timeout) {
  return http_request("POST", url, body, "application/json", timeout);
}

}  // namespace amber::console
