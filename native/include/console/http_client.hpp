#pragma once

#include <chrono>
#include <string>

namespace amber::console {

struct HttpResponse {
  bool ok = false;
  int status = 0;
  std::string body;
  std::string error;
  long duration_ms = 0;
};

struct ParsedUrl {
  std::string host;
  std::string port;
  std::string target;
};

bool parse_http_url(const std::string& url, ParsedUrl& out, std::string& error);
HttpResponse http_get(const std::string& url, std::chrono::milliseconds timeout);
HttpResponse http_get_fragment(const std::string& url, std::chrono::milliseconds timeout, std::size_t max_response_bytes);
HttpResponse http_post_json(const std::string& url, const std::string& body, std::chrono::milliseconds timeout);

}  // namespace amber::console
