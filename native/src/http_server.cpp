#include "console/http_server.hpp"

#include <arpa/inet.h>
#include <netinet/in.h>
#include <sys/socket.h>
#include <unistd.h>

#include <cstring>
#include <cstdlib>
#include <cctype>
#include <iostream>
#include <map>
#include <sstream>
#include <thread>

namespace amber::console {

std::string url_decode(const std::string& value) {
  std::string out;
  for (std::size_t i = 0; i < value.size(); ++i) {
    if (value[i] == '%' && i + 2 < value.size()) {
      char hex[3] = {value[i + 1], value[i + 2], 0};
      out.push_back(static_cast<char>(std::strtol(hex, nullptr, 16)));
      i += 2;
    } else if (value[i] == '+') {
      out.push_back(' ');
    } else {
      out.push_back(value[i]);
    }
  }
  return out;
}

std::map<std::string, std::string> parse_query(const std::string& query) {
  std::map<std::string, std::string> out;
  std::size_t pos = 0;
  while (pos < query.size()) {
    auto amp = query.find('&', pos);
    std::string part = query.substr(pos, amp == std::string::npos ? std::string::npos : amp - pos);
    auto eq = part.find('=');
    if (eq != std::string::npos) out[url_decode(part.substr(0, eq))] = url_decode(part.substr(eq + 1));
    if (amp == std::string::npos) break;
    pos = amp + 1;
  }
  return out;
}

HttpServer::HttpServer(std::string bind_host, int port, Handler handler)
    : bind_host_(std::move(bind_host)), port_(port), handler_(std::move(handler)) {}

static void write_response(int fd, const Response& response) {
  std::ostringstream head;
  std::string reason = response.status == 200 ? "OK" : response.status == 404 ? "Not Found" : "Error";
  const bool event_stream = response.content_type.rfind("text/event-stream", 0) == 0;
  head << "HTTP/1.1 " << response.status << " " << reason << "\r\n"
       << "Content-Type: " << response.content_type << "\r\n"
       << "Cache-Control: no-store\r\n"
       << "Connection: close\r\n";
  if (!event_stream) {
    head << "Content-Length: " << response.body.size() << "\r\n";
  }
  for (const auto& [k, v] : response.headers) head << k << ": " << v << "\r\n";
  head << "\r\n";
  std::string h = head.str();
  send(fd, h.data(), h.size(), MSG_NOSIGNAL);
  send(fd, response.body.data(), response.body.size(), MSG_NOSIGNAL);
}

static Request parse_request_line(const std::string& raw) {
  Request request;
  std::istringstream in(raw);
  std::string target;
  in >> request.method >> target;
  auto q = target.find('?');
  request.path = q == std::string::npos ? target : target.substr(0, q);
  request.query = q == std::string::npos ? "" : target.substr(q + 1);
  if (request.path.empty()) request.path = "/";
  return request;
}

static std::map<std::string, std::string> parse_headers(const std::string& raw) {
  std::map<std::string, std::string> headers;
  auto end = raw.find("\r\n\r\n");
  std::string head = raw.substr(0, end == std::string::npos ? raw.size() : end);
  std::istringstream in(head);
  std::string line;
  std::getline(in, line);
  while (std::getline(in, line)) {
    if (!line.empty() && line.back() == '\r') line.pop_back();
    auto colon = line.find(':');
    if (colon == std::string::npos) continue;
    std::string key = line.substr(0, colon);
    std::string value = line.substr(colon + 1);
    while (!value.empty() && value.front() == ' ') value.erase(value.begin());
    for (char& ch : key) ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
    headers[key] = value;
  }
  return headers;
}

int HttpServer::run() {
  int server_fd = socket(AF_INET, SOCK_STREAM, 0);
  if (server_fd < 0) {
    std::cerr << "socket failed: " << std::strerror(errno) << "\n";
    return 1;
  }
  int yes = 1;
  setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &yes, sizeof(yes));
  sockaddr_in addr{};
  addr.sin_family = AF_INET;
  addr.sin_port = htons(static_cast<uint16_t>(port_));
  inet_pton(AF_INET, bind_host_.c_str(), &addr.sin_addr);
  if (bind(server_fd, reinterpret_cast<sockaddr*>(&addr), sizeof(addr)) != 0) {
    std::cerr << "bind failed: " << std::strerror(errno) << "\n";
    close(server_fd);
    return 1;
  }
  if (listen(server_fd, 64) != 0) {
    std::cerr << "listen failed: " << std::strerror(errno) << "\n";
    close(server_fd);
    return 1;
  }
  std::cerr << "amber-console listening on " << bind_host_ << ":" << port_ << "\n";
  for (;;) {
    int client = accept(server_fd, nullptr, nullptr);
    if (client < 0) continue;
    std::thread([this, client]() {
      char buffer[8192];
      ssize_t n = recv(client, buffer, sizeof(buffer) - 1, 0);
      if (n <= 0) {
        close(client);
        return;
      }
      buffer[n] = 0;
      std::string raw(buffer, static_cast<std::size_t>(n));
      auto headers = parse_headers(raw);
      std::size_t content_length = 0;
      auto length_it = headers.find("content-length");
      if (length_it != headers.end()) {
        try {
          content_length = static_cast<std::size_t>(std::stoull(length_it->second));
        } catch (...) {
          content_length = 0;
        }
      }
      auto header_end = raw.find("\r\n\r\n");
      while (header_end != std::string::npos && raw.size() < header_end + 4 + content_length) {
        n = recv(client, buffer, sizeof(buffer), 0);
        if (n <= 0) break;
        raw.append(buffer, static_cast<std::size_t>(n));
      }
      Request request = parse_request_line(raw);
      header_end = raw.find("\r\n\r\n");
      if (header_end != std::string::npos && content_length > 0) {
        request.body = raw.substr(header_end + 4, content_length);
      }
      Response response = handler_(request);
      write_response(client, response);
      close(client);
    }).detach();
  }
}

}  // namespace amber::console
