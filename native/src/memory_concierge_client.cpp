#include "console/memory_concierge_client.hpp"

#include <cstdlib>
#include <sstream>

#include "console/http_client.hpp"
#include "console/json_util.hpp"

namespace amber::console {
namespace {

std::string bus_flow_url() {
  if (const char* configured = std::getenv("AMBER_CONSOLE_MEMORY_FLOW_URL")) {
    if (configured[0] != '\0') return configured;
  }
  if (const char* configured = std::getenv("AMBER_CONSOLE_MAIL_FLOW_URL")) {
    if (configured[0] != '\0') return configured;
  }
  return "http://amber-bus.amber.com:8080/api/bus/console/mail-flow";
}

}  // namespace

Response memory_concierge_flow(std::chrono::milliseconds timeout) {
  const auto url = bus_flow_url();
  const auto response = http_get(url, timeout);
  if (response.ok && !response.body.empty() && response.body.front() == '{') {
    return {200, "application/json", response.body, {}};
  }

  std::ostringstream out;
  out << "{\"schema\":\"amber.memory_concierge.flow.v1\","
      << "\"owner\":\"amber-console\","
      << "\"generated_at\":" << json_string(now_utc_iso()) << ","
      << "\"ui_data_plane\":\"amber_bus_only\","
      << "\"ok\":false,"
      << "\"error\":\"memory_concierge_bus_flow_unavailable\","
      << "\"bus_url\":" << json_string(url) << ","
      << "\"http_status\":" << response.status << ","
      << "\"duration_ms\":" << response.duration_ms << ","
      << "\"detail\":" << json_string(response.error.empty() ? response.body : response.error) << ","
      << "\"nodes\":[],\"edges\":[],\"summary\":{},\"evidence\":[],"
      << "\"raw_payload_policy\":{\"console_direct_owner_calls_allowed\":false}}";
  return {200, "application/json", out.str(), {}};
}

}  // namespace amber::console
