#pragma once

#include <functional>
#include <map>
#include <string>

namespace amber::console {

struct Request {
  std::string method;
  std::string path;
  std::string query;
};

struct Response {
  int status = 200;
  std::string content_type = "application/json";
  std::string body;
  std::map<std::string, std::string> headers;
};

using Handler = std::function<Response(const Request&)>;

class HttpServer {
 public:
  HttpServer(std::string bind_host, int port, Handler handler);
  int run();

 private:
  std::string bind_host_;
  int port_;
  Handler handler_;
};

std::string url_decode(const std::string& value);
std::map<std::string, std::string> parse_query(const std::string& query);

}  // namespace amber::console

