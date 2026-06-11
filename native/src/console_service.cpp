#include "console/console_service.hpp"

#include <chrono>
#include <fstream>
#include <regex>
#include <sstream>
#include <thread>
#include <utility>

#include "console/http_client.hpp"
#include "console/json_util.hpp"
#include "console/memory_concierge_client.hpp"

namespace amber::console {

ConsoleService::ConsoleService(std::filesystem::path web_root,
                               std::filesystem::path endpoint_config,
                               std::string version)
    : web_root_(std::move(web_root)),
      endpoint_config_(std::move(endpoint_config)),
      version_(std::move(version)) {
  load_endpoints();
}

static std::string read_file(const std::filesystem::path& path) {
  std::ifstream in(path, std::ios::binary);
  std::ostringstream out;
  out << in.rdbuf();
  return out.str();
}

static std::string content_type_for(const std::filesystem::path& path) {
  auto ext = path.extension().string();
  if (ext == ".html") return "text/html; charset=utf-8";
  if (ext == ".css") return "text/css; charset=utf-8";
  if (ext == ".js") return "application/javascript; charset=utf-8";
  if (ext == ".json") return "application/json; charset=utf-8";
  if (ext == ".md") return "text/markdown; charset=utf-8";
  if (ext == ".png") return "image/png";
  if (ext == ".jpg" || ext == ".jpeg") return "image/jpeg";
  if (ext == ".webp") return "image/webp";
  if (ext == ".svg") return "image/svg+xml";
  return "application/octet-stream";
}

static std::string json_field(const std::string& object, const std::string& key) {
  const std::regex field_re("\"" + key + "\"\\s*:\\s*\"([^\"]*)\"");
  std::smatch match;
  if (std::regex_search(object, match, field_re)) return match[1];
  return "";
}

static bool likely_complete_json_payload(const std::string& body) {
  auto first = body.find_first_not_of(" \t\r\n");
  if (first == std::string::npos) return false;
  auto last = body.find_last_not_of(" \t\r\n");
  char open = body[first];
  char close = body[last];
  return (open == '{' && close == '}') || (open == '[' && close == ']');
}

static std::string base64_decode(const std::string& input) {
  static const std::string alphabet =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  int value = 0;
  int bits = -8;
  for (unsigned char ch : input) {
    if (ch == '=') break;
    auto pos = alphabet.find(static_cast<char>(ch));
    if (pos == std::string::npos) continue;
    value = (value << 6) + static_cast<int>(pos);
    bits += 6;
    if (bits >= 0) {
      out.push_back(static_cast<char>((value >> bits) & 0xff));
      bits -= 8;
    }
  }
  return out;
}

static std::chrono::milliseconds cache_ttl_for(const HttpResponse& response) {
  return response.ok ? std::chrono::milliseconds(10000) : std::chrono::milliseconds(2000);
}

static std::size_t count_occurrences(const std::string& text, const std::string& needle) {
  if (needle.empty()) return 0;
  std::size_t count = 0;
  std::size_t pos = 0;
  while ((pos = text.find(needle, pos)) != std::string::npos) {
    ++count;
    pos += needle.size();
  }
  return count;
}

static std::size_t count_sse_data_events(const std::string& text) {
  std::size_t count = 0;
  if (text.rfind("data:", 0) == 0) ++count;
  std::size_t pos = 0;
  while ((pos = text.find("\ndata:", pos)) != std::string::npos) {
    ++count;
    pos += 6;
  }
  return count;
}

static int json_int_value(const std::string& object, const std::string& key, int fallback = 0) {
  const std::regex field_re("\"" + key + "\"\\s*:\\s*([0-9]+)");
  std::smatch match;
  if (std::regex_search(object, match, field_re)) {
    try {
      return std::stoi(match[1]);
    } catch (...) {
    }
  }
  return fallback;
}

static std::size_t count_non_null_json_key(const std::string& object, const std::string& key) {
  const std::regex field_re("\"" + key + "\"\\s*:\\s*(null|\"([^\"]+)\"|[0-9]+|true|false)");
  std::size_t count = 0;
  for (auto it = std::sregex_iterator(object.begin(), object.end(), field_re); it != std::sregex_iterator(); ++it) {
    if ((*it)[1] != "null") ++count;
  }
  return count;
}

static std::string first_non_null_json_key(const std::string& object, const std::string& key) {
  const std::regex field_re("\"" + key + "\"\\s*:\\s*(null|\"([^\"]+)\"|([0-9]+)|true|false)");
  for (auto it = std::sregex_iterator(object.begin(), object.end(), field_re); it != std::sregex_iterator(); ++it) {
    if ((*it)[1] == "null") continue;
    if ((*it)[2].matched) return (*it)[2];
    if ((*it)[3].matched) return (*it)[3];
    return (*it)[1];
  }
  return "";
}

void ConsoleService::load_endpoints() {
  std::string data = read_file(endpoint_config_);
  const std::regex row_re("\\{[^\\{\\}]*\"id\"\\s*:\\s*\"[^\"]+\"[^\\{\\}]*\\}");
  for (auto it = std::sregex_iterator(data.begin(), data.end(), row_re); it != std::sregex_iterator(); ++it) {
    const std::string object = it->str();
    OwnerEndpoint endpoint;
    endpoint.id = json_field(object, "id");
    endpoint.label = json_field(object, "label");
    endpoint.owner = json_field(object, "owner");
    endpoint.url = json_field(object, "url");
    endpoint.panel = json_field(object, "panel");
    endpoint.transport = json_field(object, "transport");
    endpoint.invoke_surface = json_field(object, "invoke_surface");
    endpoint.invoke_method = json_field(object, "invoke_method");
    endpoint.invoke_path = json_field(object, "invoke_path");
    endpoint.invoke_query = json_field(object, "invoke_query");
    endpoint.invoke_body_base64 = json_field(object, "invoke_body_base64");
    endpoint.invoke_action = json_field(object, "invoke_action");
    endpoint.invoke_minutes = json_field(object, "invoke_minutes");
    endpoint.overview_mode = json_field(object, "overview_mode");
    endpoint.overview_reason = json_field(object, "overview_reason");
    if (endpoint.transport.empty()) endpoint.transport = "bus_get";
    if (endpoint.invoke_method.empty()) endpoint.invoke_method = "GET";
    if (endpoint.id.empty() || endpoint.url.empty()) continue;
    endpoints_.push_back(endpoint);
    endpoint_by_id_[endpoint.id] = endpoint;
  }
}

Response ConsoleService::route(const Request& request) {
  if (request.path == "/health") return health();
  if (request.path == "/api/console/overview") return overview();
  if (request.path == "/api/console/events") return event_stream();
  if (request.path == "/api/console/logger-incident-stream-proof") return logger_incident_stream_proof();
  if (request.path == "/api/console/logger-request-proof-depth") return logger_request_proof_depth();
  if (request.path == "/api/console/evidence-chain") return evidence_chain();
  if (request.path == "/api/console/memory-concierge-flow") return memory_concierge_flow(std::chrono::milliseconds(10000));
  if (request.path == "/api/console/mail-flow") return memory_concierge_flow(std::chrono::milliseconds(10000));
  if (request.path == "/api/console/source") return source_detail(request);
  if (request.path == "/api/console/source-action") return source_action(request);
  if (request.path == "/architecture" || request.path == "/architecture/") return static_file("/architecture/index.html");
  return static_file(request.path == "/" ? "/index.html" : request.path);
}

std::chrono::milliseconds ConsoleService::overview_timeout_for(const OwnerEndpoint& endpoint) {
  if (endpoint.id == "veliai_queue" || endpoint.id == "veliai_artifacts" || endpoint.id == "veliai_brain_edge") {
    return std::chrono::milliseconds(5000);
  }
  if (endpoint.id == "memorr_e32_status") {
    return std::chrono::milliseconds(9000);
  }
  if (endpoint.id == "amber_bus_overview") {
    return std::chrono::milliseconds(2500);
  }
  return std::chrono::milliseconds(1500);
}

Response ConsoleService::health() const {
  std::ostringstream out;
  out << "{\"schema\":\"amber.console.health.v1\",\"ok\":true,\"owner\":\"amber-console\","
      << "\"version\":" << json_string(version_) << ","
      << "\"generated_at\":" << json_string(now_utc_iso()) << ","
      << "\"endpoint_count\":" << endpoints_.size() << ","
      << "\"data_plane\":\"amber_bus_only\","
      << "\"truth_rule\":\"owner services are authoritative; console snapshots are display only; UI data reaches owners through Amber Bus contracts only\"}";
  return {200, "application/json", out.str(), {}};
}

HttpResponse ConsoleService::fetch_endpoint(const OwnerEndpoint& endpoint, std::chrono::milliseconds timeout) const {
  if (endpoint.transport == "bus_invoke") {
    std::ostringstream body;
    if (!endpoint.invoke_action.empty()) {
      body << "{\"action\":" << json_string(endpoint.invoke_action);
      if (!endpoint.invoke_minutes.empty()) body << ",\"minutes\":" << endpoint.invoke_minutes;
      body << "}";
    } else if (!endpoint.invoke_path.empty()) {
      body << "{";
      bool has_field = false;
      if (!endpoint.invoke_surface.empty()) {
        body << "\"surface\":" << json_string(endpoint.invoke_surface);
        has_field = true;
      }
      if (has_field) body << ",";
      body << "\"method\":" << json_string(endpoint.invoke_method.empty() ? "GET" : endpoint.invoke_method)
           << ",\"path\":" << json_string(endpoint.invoke_path);
      if (!endpoint.invoke_query.empty()) body << ",\"query\":" << json_string(endpoint.invoke_query);
      if (!endpoint.invoke_body_base64.empty()) body << ",\"body_base64\":" << json_string(endpoint.invoke_body_base64);
      body << "}";
    } else {
      if (!endpoint.invoke_body_base64.empty()) {
        body << base64_decode(endpoint.invoke_body_base64);
      } else {
        body << "{";
        if (!endpoint.invoke_minutes.empty()) {
        body << "\"minutes\":" << endpoint.invoke_minutes;
        }
        body << "}";
      }
    }
    return http_post_json(endpoint.url, body.str(), timeout);
  }
  return http_get(endpoint.url, timeout);
}

HttpResponse ConsoleService::fetch_endpoint_cached(const OwnerEndpoint& endpoint, std::chrono::milliseconds timeout) const {
  const auto now = std::chrono::steady_clock::now();
  {
    std::lock_guard<std::mutex> lock(cache_mutex_);
    auto found = endpoint_cache_.find(endpoint.id);
    if (found != endpoint_cache_.end() && now - found->second.fetched_at <= cache_ttl_for(found->second.response)) {
      HttpResponse cached = found->second.response;
      cached.duration_ms = 0;
      return cached;
    }
  }

  HttpResponse response = fetch_endpoint(endpoint, timeout);
  {
    std::lock_guard<std::mutex> lock(cache_mutex_);
    endpoint_cache_[endpoint.id] = CachedEndpointResponse{response, std::chrono::steady_clock::now()};
  }
  return response;
}

Response ConsoleService::overview() const {
  std::ostringstream out;
  out << "{\"schema\":\"amber.console.overview.v1\",\"generated_at\":" << json_string(now_utc_iso())
      << ",\"owner\":\"amber-console\",\"authority\":\"observability_only\","
      << "\"data_plane\":\"amber_bus_only\","
      << "\"truth_rule\":\"owner_services_authoritative_via_amber_bus\",";
  out << "\"sources\":[";
  bool first = true;
  int ok_count = 0;
  int degraded_count = 0;
  for (const auto& endpoint : endpoints_) {
    HttpResponse response;
    std::string state = "deferred";
    if (endpoint.overview_mode == "deferred") {
      response.status = 202;
      response.ok = true;
      response.body = "{\"ok\":true,\"deferred\":true,\"reason\":\"detail_only_heavy_source\"}";
      response.duration_ms = 0;
    } else if (endpoint.overview_mode == "blocked") {
      response.status = 0;
      response.ok = false;
      response.error = endpoint.overview_reason.empty() ? "owner contract unavailable; use source detail for live probe" : endpoint.overview_reason;
      response.body = std::string("{\"ok\":false,\"blocked\":true,\"reason\":") + json_string(response.error) + "}";
      response.duration_ms = 0;
      state = "unavailable";
    } else {
      response = fetch_endpoint_cached(endpoint, overview_timeout_for(endpoint));
      state = status_from_payload(response.status, response.body);
    }
    if (state == "ok") ok_count++; else degraded_count++;
    if (!first) out << ",";
    first = false;
    out << "{\"id\":" << json_string(endpoint.id)
        << ",\"label\":" << json_string(endpoint.label)
        << ",\"owner\":" << json_string(endpoint.owner)
        << ",\"panel\":" << json_string(endpoint.panel)
        << ",\"url\":" << json_string(endpoint.url)
        << ",\"transport\":" << json_string(endpoint.transport)
        << ",\"data_plane\":\"amber_bus_only\""
        << ",\"http_status\":" << response.status
        << ",\"state\":" << json_string(state)
        << ",\"duration_ms\":" << response.duration_ms
        << ",\"preview\":" << json_string(compact_preview(response.ok ? response.body : response.error, 360))
        << "}";
  }
  out << "],\"summary\":{\"ok\":" << ok_count << ",\"degraded_or_unavailable\":" << degraded_count
      << ",\"total\":" << endpoints_.size() << "}}";
  return {200, "application/json", out.str(), {}};
}

static void append_sse_event(std::ostringstream& out,
                             const std::string& event,
                             const std::string& id,
                             const std::string& data) {
  out << "event: " << event << "\n";
  out << "id: " << id << "\n";
  out << "data: " << data << "\n\n";
}

Response ConsoleService::event_stream() const {
  const auto generated_at = now_utc_iso();
  const auto event_id_base = std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
      std::chrono::system_clock::now().time_since_epoch()).count());
  std::size_t deferred_count = 0;
  std::size_t blocked_count = 0;
  for (const auto& endpoint : endpoints_) {
    if (endpoint.overview_mode == "deferred") ++deferred_count;
    if (endpoint.overview_mode == "blocked") ++blocked_count;
  }
  std::size_t cache_entries = 0;
  {
    std::lock_guard<std::mutex> lock(cache_mutex_);
    cache_entries = endpoint_cache_.size();
  }

  std::ostringstream body;
  body << "retry: 700\n\n";
  append_sse_event(
      body,
      "console.heartbeat",
      event_id_base + "-0",
      std::string("{\"schema\":\"amber.console.stream_event.v1\",\"event\":\"heartbeat\",")
          + "\"generated_at\":" + json_string(generated_at)
          + ",\"owner\":\"amber-console\",\"data_plane\":\"amber_bus_only\","
          + "\"truth_rule\":\"owner services remain authoritative; this stream reports Console source-contract freshness only\"}");
  append_sse_event(
      body,
      "console.source_summary",
      event_id_base + "-1",
      std::string("{\"schema\":\"amber.console.source_summary_event.v1\",\"event\":\"source_summary\",")
          + "\"generated_at\":" + json_string(generated_at)
          + ",\"source_total\":" + std::to_string(endpoints_.size())
          + ",\"deferred_sources\":" + std::to_string(deferred_count)
          + ",\"blocked_sources\":" + std::to_string(blocked_count)
          + ",\"cache_entries\":" + std::to_string(cache_entries)
          + ",\"data_plane\":\"amber_bus_only\"}");
  append_sse_event(
      body,
      "console.close",
      event_id_base + "-2",
      std::string("{\"schema\":\"amber.console.stream_close_event.v1\",\"event\":\"bounded_close\",")
          + "\"generated_at\":" + json_string(generated_at)
          + ",\"reason\":\"bounded_reconnect_probe\","
          + "\"next_retry_ms\":700}");

  return {200,
          "text/event-stream; charset=utf-8",
          body.str(),
          {{"X-Accel-Buffering", "no"}, {"Access-Control-Allow-Origin", "same-origin"}}};
}

Response ConsoleService::logger_incident_stream_proof() const {
  const std::string bus_url =
      "http://amber-bus.amber.com:8080/api/bus/invoke/logger.incident.stream?interval_ms=1200";
  HttpResponse response = http_get_fragment(bus_url, std::chrono::milliseconds(6500), 196608);
  const std::string& body = response.body;
  const auto data_events = count_sse_data_events(body);
  const auto log_count = count_occurrences(body, "\"level\":");
  const auto incident_ids = count_occurrences(body, "\"incident_id\":");
  const auto correlation_ids = count_occurrences(body, "\"correlation_id\":");
  const auto timelines = count_occurrences(body, "\"narrative\":");
  const bool has_logs = body.find("\"logs\":[") != std::string::npos;
  const bool has_timelines = body.find("\"incident_timelines\":[") != std::string::npos;
  const bool has_correlations = body.find("\"correlations\":[") != std::string::npos;
  const bool ok = response.ok && data_events > 0 && (has_logs || has_timelines || has_correlations);

  std::ostringstream out;
  out << "{\"schema\":\"amber.console.logger_incident_stream_proof.v1\","
      << "\"generated_at\":" << json_string(now_utc_iso()) << ","
      << "\"owner\":\"logger\","
      << "\"source\":\"logger.incident.stream\","
      << "\"bus_url\":" << json_string(bus_url) << ","
      << "\"data_plane\":\"amber_bus_only\","
      << "\"ok\":" << (ok ? "true" : "false") << ","
      << "\"http_status\":" << response.status << ","
      << "\"duration_ms\":" << response.duration_ms << ","
      << "\"sse_event_count\":" << data_events << ","
      << "\"log_count\":" << log_count << ","
      << "\"incident_id_count\":" << incident_ids << ","
      << "\"correlation_id_count\":" << correlation_ids << ","
      << "\"incident_timeline_count\":" << timelines << ","
      << "\"has_logs\":" << (has_logs ? "true" : "false") << ","
      << "\"has_incident_timelines\":" << (has_timelines ? "true" : "false") << ","
      << "\"has_correlations\":" << (has_correlations ? "true" : "false") << ","
      << "\"error\":" << json_string(response.error) << ","
      << "\"preview\":" << json_string(compact_preview(response.ok ? body : response.error, 700))
      << "}";
  return {200, "application/json", out.str(), {}};
}

Response ConsoleService::logger_request_proof_depth() const {
  const std::string proof_url =
      "http://amber-bus.amber.com:8080/api/bus/invoke/logger.evidence.proof?interface_id=logger.api.evidence.query.v1";
  const std::string owner_proof_body =
      "{\"owner_app\":\"aigateway\",\"include_events\":true,\"limit\":25,\"minutes\":60}";
  const std::string fallback_proof_body =
      "{\"include_events\":true,\"limit\":25,\"minutes\":60}";
  HttpResponse proof = http_post_json(proof_url, owner_proof_body, std::chrono::milliseconds(6500));
  std::string body = proof.body;
  std::string proof_scope = "owner_app:aigateway";
  if (proof.ok && json_int_value(body, "event_count") == 0) {
    HttpResponse fallback = http_post_json(proof_url, fallback_proof_body, std::chrono::milliseconds(6500));
    if (fallback.ok && json_int_value(fallback.body, "event_count") > 0) {
      proof = fallback;
      body = proof.body;
      proof_scope = "all_logger_events_fallback";
    }
  }
  const bool evidence_present = proof.ok && body.find("\"gate_status\":\"evidence_present\"") != std::string::npos;
  const int event_count = json_int_value(body, "event_count");
  const int missing_correlation_count = json_int_value(body, "missing_correlation_count");
  const auto correlation_id_count = count_non_null_json_key(body, "correlation_id");
  const auto request_id_count = count_non_null_json_key(body, "request_id");
  const auto incident_id_count = count_non_null_json_key(body, "incident_id");
  const auto migration_id_count = count_non_null_json_key(body, "migration_id");
  const auto outcome_id_count = count_non_null_json_key(body, "outcome_id");
  const auto lifecycle_stage_count = count_non_null_json_key(body, "lifecycle_stage");
  const bool request_specific_ready = correlation_id_count > 0 || request_id_count > 0;
  const std::string sample_correlation = first_non_null_json_key(body, "correlation_id");
  const std::string sample_request = first_non_null_json_key(body, "request_id");
  const std::string sample_incident = first_non_null_json_key(body, "incident_id");

  std::ostringstream out;
  out << "{\"schema\":\"amber.console.logger_request_proof_depth.v1\","
      << "\"generated_at\":" << json_string(now_utc_iso()) << ","
      << "\"owner\":\"logger\","
      << "\"source\":\"logger.evidence.proof\","
      << "\"proof_scope\":" << json_string(proof_scope) << ","
      << "\"bus_url\":" << json_string(proof_url) << ","
      << "\"data_plane\":\"amber_bus_only\","
      << "\"ok\":" << (proof.ok && evidence_present ? "true" : "false") << ","
      << "\"request_specific_ready\":" << (request_specific_ready ? "true" : "false") << ","
      << "\"state\":" << json_string(request_specific_ready ? "ready" : (evidence_present ? "blocked" : "unavailable")) << ","
      << "\"http_status\":" << proof.status << ","
      << "\"duration_ms\":" << proof.duration_ms << ","
      << "\"event_count\":" << event_count << ","
      << "\"missing_correlation_count\":" << missing_correlation_count << ","
      << "\"correlation_id_count\":" << correlation_id_count << ","
      << "\"request_id_count\":" << request_id_count << ","
      << "\"incident_id_count\":" << incident_id_count << ","
      << "\"migration_id_count\":" << migration_id_count << ","
      << "\"outcome_id_count\":" << outcome_id_count << ","
      << "\"lifecycle_stage_count\":" << lifecycle_stage_count << ","
      << "\"sample_correlation_id\":" << json_string(sample_correlation) << ","
      << "\"sample_request_id\":" << json_string(sample_request) << ","
      << "\"sample_incident_id\":" << json_string(sample_incident) << ","
      << "\"open_gate\":" << json_string(request_specific_ready
             ? "request/correlation identifiers are available for targeted proof"
             : (evidence_present
                    ? "owner events currently lack emitted request_id/correlation_id values for targeted proof"
                    : "Logger evidence proof returned no current events for the requested proof window")) << ","
      << "\"error\":" << json_string(proof.error) << ","
      << "\"preview\":" << json_string(compact_preview(proof.ok ? body : proof.error, 900))
      << "}";
  return {200, "application/json", out.str(), {}};
}

Response ConsoleService::evidence_chain() const {
  const std::vector<std::string> ids = {
      "mail_flow", "concierge_email", "exchange_connector_status", "exchange_pim_reader",
      "mail_quarantine_review",
      "memorr_archive", "memorr_exchange_backfill", "memorr_exchange_pim_context",
      "memorr_formulated_memory", "gemma_models", "veliai_queue", "veliai_artifacts",
      "veliai_brain_edge", "epic26_tasks"};
  std::ostringstream out;
  out << "{\"schema\":\"amber.console.evidence_chain.v1\",\"generated_at\":" << json_string(now_utc_iso())
      << ",\"nodes\":[";
  bool first = true;
  for (const auto& id : ids) {
    auto found = endpoint_by_id_.find(id);
    if (found == endpoint_by_id_.end()) continue;
    const auto& endpoint = found->second;
    HttpResponse response;
    std::string state = "unavailable";
    if (endpoint.overview_mode == "blocked") {
      response.status = 0;
      response.ok = false;
      response.error = endpoint.overview_reason.empty() ? "owner contract unavailable; use source detail for live probe" : endpoint.overview_reason;
      response.body = std::string("{\"ok\":false,\"blocked\":true,\"reason\":") + json_string(response.error) + "}";
      response.duration_ms = 0;
    } else {
      response = fetch_endpoint_cached(endpoint, overview_timeout_for(endpoint));
      state = status_from_payload(response.status, response.body);
    }
    if (!first) out << ",";
    first = false;
    out << "{\"id\":" << json_string(endpoint.id)
        << ",\"label\":" << json_string(endpoint.label)
        << ",\"owner\":" << json_string(endpoint.owner)
        << ",\"transport\":" << json_string(endpoint.transport)
        << ",\"data_plane\":\"amber_bus_only\""
        << ",\"state\":" << json_string(state)
        << ",\"http_status\":" << response.status
        << ",\"duration_ms\":" << response.duration_ms
        << ",\"detail_path\":\"/api/console/source?target=" << endpoint.id << "\""
        << ",\"preview\":" << json_string(compact_preview(response.ok ? response.body : response.error, 500))
        << "}";
  }
  out << "],\"edges\":["
      << "{\"from\":\"mail_flow\",\"to\":\"concierge_email\",\"label\":\"shared Bus state\"},"
      << "{\"from\":\"concierge_email\",\"to\":\"mail_quarantine_review\",\"label\":\"quarantine review\"},"
      << "{\"from\":\"concierge_email\",\"to\":\"memorr_archive\",\"label\":\"archive candidate\"},"
      << "{\"from\":\"concierge_email\",\"to\":\"exchange_connector_status\",\"label\":\"Exchange delivery\"},"
      << "{\"from\":\"exchange_connector_status\",\"to\":\"exchange_pim_reader\",\"label\":\"PIM read\"},"
      << "{\"from\":\"exchange_pim_reader\",\"to\":\"memorr_exchange_pim_context\",\"label\":\"context synthesis\"},"
      << "{\"from\":\"exchange_connector_status\",\"to\":\"memorr_exchange_backfill\",\"label\":\"read-only backfill\"},"
      << "{\"from\":\"memorr_exchange_backfill\",\"to\":\"memorr_formulated_memory\",\"label\":\"formulated memory\"},"
      << "{\"from\":\"memorr_exchange_pim_context\",\"to\":\"gemma_models\",\"label\":\"Gemma index refs\"},"
      << "{\"from\":\"memorr_archive\",\"to\":\"memorr_mirror\",\"label\":\"durable object\"},"
      << "{\"from\":\"memorr_mirror\",\"to\":\"veliai_queue\",\"label\":\"OCR/formulation route\"},"
      << "{\"from\":\"veliai_queue\",\"to\":\"veliai_artifacts\",\"label\":\"result artifact\"},"
      << "{\"from\":\"veliai_queue\",\"to\":\"veliai_brain_edge\",\"label\":\"brain-edge graph\"},"
      << "{\"from\":\"veliai_brain_edge\",\"to\":\"memorr_formulated_memory\",\"label\":\"profile memory refs\"},"
      << "{\"from\":\"veliai_artifacts\",\"to\":\"epic26_tasks\",\"label\":\"operator proof\"}"
      << "]}";
  return {200, "application/json", out.str(), {}};
}

Response ConsoleService::source_detail(const Request& request) const {
  auto query = parse_query(request.query);
  auto id = query["target"];
  auto found = endpoint_by_id_.find(id);
  if (found == endpoint_by_id_.end()) {
    return {404, "application/json", "{\"ok\":false,\"error\":\"unknown target\"}", {}};
  }
  const auto& endpoint = found->second;
  HttpResponse response = fetch_endpoint_cached(
      endpoint,
      endpoint.id == "memorr_e32_status" ? std::chrono::milliseconds(15000) : std::chrono::milliseconds(9000));
  const std::string logger_evidence_mode = query["logger_evidence"];
  const bool include_logger_evidence =
      logger_evidence_mode != "0" && logger_evidence_mode != "false" && logger_evidence_mode != "skip";
  const std::string logger_evidence =
      include_logger_evidence ? emit_source_fetch_logger_evidence(endpoint, response) : "";
  std::ostringstream out;
  out << "{\"schema\":\"amber.console.source_detail.v1\",\"generated_at\":" << json_string(now_utc_iso())
      << ",\"id\":" << json_string(endpoint.id)
      << ",\"label\":" << json_string(endpoint.label)
      << ",\"owner\":" << json_string(endpoint.owner)
      << ",\"url\":" << json_string(endpoint.url)
      << ",\"transport\":" << json_string(endpoint.transport)
      << ",\"data_plane\":\"amber_bus_only\""
      << ",\"http_status\":" << response.status
      << ",\"ok\":" << (response.ok ? "true" : "false")
      << ",\"duration_ms\":" << response.duration_ms
      << ",\"error\":" << json_string(response.error);
  if (include_logger_evidence) out << ",\"logger_call_evidence\":" << logger_evidence;
  out << ",\"payload\":";
  if (response.ok && likely_complete_json_payload(response.body)) {
    out << response.body;
  } else {
    out << json_string(response.ok ? response.body : response.error);
  }
  out << "}";
  return {200, "application/json", out.str(), {}};
}

Response ConsoleService::source_action(const Request& request) const {
  if (request.method != "POST") {
    return {405, "application/json", "{\"ok\":false,\"error\":\"method_not_allowed\"}", {}};
  }
  auto query = parse_query(request.query);
  auto id = query["target"];
  auto found = endpoint_by_id_.find(id);
  if (found == endpoint_by_id_.end()) {
    return {404, "application/json", "{\"ok\":false,\"error\":\"unknown target\"}", {}};
  }
  const auto& endpoint = found->second;
  if (endpoint.transport != "bus_post") {
    return {403, "application/json", "{\"ok\":false,\"error\":\"target_not_write_enabled\"}", {}};
  }
  if (request.body.size() > 256 * 1024) {
    return {413, "application/json", "{\"ok\":false,\"error\":\"body_too_large\"}", {}};
  }
  HttpResponse response = http_post_json(endpoint.url, request.body.empty() ? "{}" : request.body, std::chrono::milliseconds(9000));
  {
    std::lock_guard<std::mutex> lock(cache_mutex_);
    endpoint_cache_.erase(endpoint.id);
  }
  std::ostringstream out;
  out << "{\"schema\":\"amber.console.source_action_result.v1\",\"generated_at\":" << json_string(now_utc_iso())
      << ",\"id\":" << json_string(endpoint.id)
      << ",\"label\":" << json_string(endpoint.label)
      << ",\"owner\":" << json_string(endpoint.owner)
      << ",\"url\":" << json_string(endpoint.url)
      << ",\"transport\":" << json_string(endpoint.transport)
      << ",\"data_plane\":\"amber_bus_only\""
      << ",\"http_status\":" << response.status
      << ",\"ok\":" << (response.ok ? "true" : "false")
      << ",\"duration_ms\":" << response.duration_ms
      << ",\"error\":" << json_string(response.error)
      << ",\"payload\":";
  if (response.ok && likely_complete_json_payload(response.body)) {
    out << response.body;
  } else {
    out << json_string(response.ok ? response.body : response.error);
  }
  out << "}";
  return {response.ok ? 200 : 502, "application/json", out.str(), {}};
}

std::string ConsoleService::emit_source_fetch_logger_evidence(
    const OwnerEndpoint& endpoint,
    const HttpResponse& source_response) const {
  const std::string request_id = std::string("console-source-") + endpoint.id + "-" +
      std::to_string(std::chrono::duration_cast<std::chrono::milliseconds>(
          std::chrono::system_clock::now().time_since_epoch()).count());
  const std::string correlation_id = request_id;
  const std::string ingest_url = "http://amber-bus.amber.com:8080/api/bus/invoke/logger.log.ingest";
  const std::string proof_url =
      "http://amber-bus.amber.com:8080/api/bus/invoke/logger.evidence.proof?interface_id=logger.api.evidence.query.v1";

  std::ostringstream ingest_body;
  ingest_body << "{\"app\":\"amber-console\","
              << "\"service\":\"source-detail\","
              << "\"level\":\"INFO\","
              << "\"message\":\"Console source detail fetch proof\","
              << "\"correlation_id\":" << json_string(correlation_id) << ","
              << "\"tags\":[\"epic26\",\"console-source-fetch\",\"amber-bus-only\"],"
              << "\"context\":{"
              << "\"schema\":\"amber.console.source_fetch_logger_evidence.v1\","
              << "\"source_id\":" << json_string(endpoint.id) << ","
              << "\"label\":" << json_string(endpoint.label) << ","
              << "\"owner\":" << json_string(endpoint.owner) << ","
              << "\"transport\":" << json_string(endpoint.transport) << ","
              << "\"http_status\":" << source_response.status << ","
              << "\"ok\":" << (source_response.ok ? "true" : "false") << ","
              << "\"duration_ms\":" << source_response.duration_ms << ","
              << "\"data_plane\":\"amber_bus_only\","
              << "\"request_id\":" << json_string(request_id) << ","
              << "\"correlation_id\":" << json_string(correlation_id) << ","
              << "\"lifecycle_stage\":\"console_source_fetch\""
              << "}}";

  HttpResponse ingest = http_post_json(ingest_url, ingest_body.str(), std::chrono::milliseconds(9000));
  const int ingest_stored_count = ingest.ok ? json_int_value(ingest.body, "stored") : 0;

  std::ostringstream proof_body;
  proof_body << "{\"owner_app\":\"amber-console\",\"include_events\":true,\"limit\":25,\"minutes\":10}";
  HttpResponse proof;
  std::string gate_status;
  int event_count = 0;
  bool request_seen = false;
  for (int attempt = 0; attempt < 4; ++attempt) {
    proof = http_post_json(proof_url, proof_body.str(), std::chrono::milliseconds(900));
    gate_status = proof.ok ? json_field(proof.body, "gate_status") : "";
    event_count = proof.ok ? json_int_value(proof.body, "event_count") : 0;
    request_seen = proof.ok && proof.body.find(request_id) != std::string::npos;
    if (request_seen) break;
    if (attempt < 3) std::this_thread::sleep_for(std::chrono::milliseconds(250));
  }
  const bool ok = ingest.ok && ingest_stored_count > 0;

  std::ostringstream out;
  out << "{\"schema\":\"amber.console.source_fetch_logger_evidence.v1\","
      << "\"generated_at\":" << json_string(now_utc_iso()) << ","
      << "\"owner\":\"logger\","
      << "\"source\":\"logger.log.ingest\","
      << "\"proof_source\":\"logger.evidence.proof\","
      << "\"data_plane\":\"amber_bus_only\","
      << "\"request_id\":" << json_string(request_id) << ","
      << "\"correlation_id\":" << json_string(correlation_id) << ","
      << "\"ingest_url\":" << json_string(ingest_url) << ","
      << "\"proof_url\":" << json_string(proof_url) << ","
      << "\"ok\":" << (ok ? "true" : "false") << ","
      << "\"ingest_ok\":" << (ingest.ok ? "true" : "false") << ","
      << "\"ingest_http_status\":" << ingest.status << ","
      << "\"ingest_duration_ms\":" << ingest.duration_ms << ","
      << "\"ingest_stored_count\":" << ingest_stored_count << ","
      << "\"proof_ok\":" << (proof.ok ? "true" : "false") << ","
      << "\"proof_http_status\":" << proof.status << ","
      << "\"proof_duration_ms\":" << proof.duration_ms << ","
      << "\"proof_gate_status\":" << json_string(gate_status) << ","
      << "\"proof_event_count\":" << event_count << ","
      << "\"proof_request_seen\":" << (request_seen ? "true" : "false") << ","
      << "\"error\":" << json_string(!ingest.error.empty() ? ingest.error : proof.error)
      << "}";
  return out.str();
}

Response ConsoleService::static_file(const std::string& path) const {
  std::filesystem::path rel = url_decode(path);
  std::filesystem::path full = std::filesystem::weakly_canonical(web_root_ / rel.relative_path());
  std::filesystem::path root = std::filesystem::weakly_canonical(web_root_);
  const std::string full_text = full.string();
  const std::string root_text = root.string();
  if (full_text.rfind(root_text, 0) != 0) {
    return {404, "text/plain; charset=utf-8", "not found", {}};
  }
  if (!std::filesystem::exists(full) || std::filesystem::is_directory(full)) {
    return {404, "text/plain; charset=utf-8", "not found", {}};
  }
  return {200, content_type_for(full), read_file(full), {}};
}

}  // namespace amber::console
