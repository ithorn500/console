#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <sstream>
#include <thread>
#include <vector>

#include "console/console_service.hpp"
#include "console/http_server.hpp"

int main(int argc, char** argv) {
  std::string bind = std::getenv("AMBER_CONSOLE_BIND") ? std::getenv("AMBER_CONSOLE_BIND") : "0.0.0.0";
  int port = std::getenv("AMBER_CONSOLE_PORT") ? std::atoi(std::getenv("AMBER_CONSOLE_PORT")) : 8095;
  std::filesystem::path root = argc > 1 ? argv[1] : "/opt/console/web";
  std::filesystem::path config = argc > 2 ? argv[2] : "/opt/console/config/owner_endpoints.v1.json";

  amber::console::ConsoleService service(root, config, "0.1.0-epic26");
  auto handler = [&](const amber::console::Request& req) {
    return service.route(req);
  };

  std::vector<int> extra_ports;
  if (const char* env = std::getenv("AMBER_CONSOLE_EXTRA_PORTS")) {
    std::stringstream in(env);
    std::string token;
    while (std::getline(in, token, ',')) {
      int extra = std::atoi(token.c_str());
      if (extra > 0 && extra != port) extra_ports.push_back(extra);
    }
  }
  for (int extra : extra_ports) {
    std::thread([bind, extra, &handler]() {
      amber::console::HttpServer extra_server(bind, extra, handler);
      extra_server.run();
    }).detach();
  }

  amber::console::HttpServer server(bind, port, handler);
  return server.run();
}
