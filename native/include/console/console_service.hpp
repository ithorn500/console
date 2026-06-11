#pragma once

#include <filesystem>
#include <chrono>
#include <map>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

#include "console/http_client.hpp"
#include "console/http_server.hpp"

namespace amber::console {

struct OwnerEndpoint {
  std::string id;
  std::string label;
  std::string owner;
  std::string url;
  std::string panel;
  std::string transport;
  std::string invoke_surface;
  std::string invoke_method;
  std::string invoke_path;
  std::string invoke_query;
  std::string invoke_body_base64;
  std::string invoke_action;
  std::string invoke_minutes;
  std::string overview_mode;
  std::string overview_reason;
};

struct CachedEndpointResponse {
  HttpResponse response;
  std::chrono::steady_clock::time_point fetched_at;
};

class ConsoleService {
 public:
  ConsoleService(std::filesystem::path web_root,
                 std::filesystem::path endpoint_config,
                 std::string version);

  Response route(const Request& request);

 private:
  std::filesystem::path web_root_;
  std::filesystem::path endpoint_config_;
  std::string version_;
  std::vector<OwnerEndpoint> endpoints_;
  std::map<std::string, OwnerEndpoint> endpoint_by_id_;
  mutable std::mutex cache_mutex_;
  mutable std::unordered_map<std::string, CachedEndpointResponse> endpoint_cache_;

  void load_endpoints();
  Response health() const;
  Response overview() const;
  Response event_stream() const;
  Response logger_incident_stream_proof() const;
  Response logger_request_proof_depth() const;
  Response evidence_chain() const;
  Response source_detail(const Request& request) const;
  Response source_action(const Request& request) const;
  std::string emit_source_fetch_logger_evidence(const OwnerEndpoint& endpoint, const HttpResponse& source_response) const;
  Response static_file(const std::string& path) const;
  HttpResponse fetch_endpoint(const OwnerEndpoint& endpoint, std::chrono::milliseconds timeout) const;
  HttpResponse fetch_endpoint_cached(const OwnerEndpoint& endpoint, std::chrono::milliseconds timeout) const;
  static std::chrono::milliseconds overview_timeout_for(const OwnerEndpoint& endpoint);
};

}  // namespace amber::console
