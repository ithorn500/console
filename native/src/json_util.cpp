#include "console/json_util.hpp"

#include <chrono>
#include <ctime>
#include <iomanip>
#include <sstream>

namespace amber::console {

std::string json_escape(const std::string& value) {
  std::ostringstream out;
  for (unsigned char c : value) {
    switch (c) {
      case '"': out << "\\\""; break;
      case '\\': out << "\\\\"; break;
      case '\b': out << "\\b"; break;
      case '\f': out << "\\f"; break;
      case '\n': out << "\\n"; break;
      case '\r': out << "\\r"; break;
      case '\t': out << "\\t"; break;
      default:
        if (c < 0x20) {
          out << "\\u" << std::hex << std::setw(4) << std::setfill('0') << int(c);
        } else {
          out << c;
        }
    }
  }
  return out.str();
}

std::string json_string(const std::string& value) { return "\"" + json_escape(value) + "\""; }

std::string now_utc_iso() {
  auto now = std::chrono::system_clock::now();
  std::time_t t = std::chrono::system_clock::to_time_t(now);
  std::tm tm{};
  gmtime_r(&t, &tm);
  std::ostringstream out;
  out << std::put_time(&tm, "%Y-%m-%dT%H:%M:%SZ");
  return out.str();
}

std::string status_from_payload(int http_status, const std::string& payload) {
  if (http_status < 200 || http_status >= 300) return "unavailable";
  if (payload.find("\"service_state\":\"degraded\"") != std::string::npos ||
      payload.find("\"service_state\": \"degraded\"") != std::string::npos ||
      payload.find("\"rag\":\"red\"") != std::string::npos) {
    return "degraded";
  }
  if (payload.find("\"ok\":false") != std::string::npos ||
      payload.find("\"ok\": false") != std::string::npos) {
    return "degraded";
  }
  return "ok";
}

std::string compact_preview(const std::string& payload, std::size_t limit) {
  std::string out;
  out.reserve(std::min(payload.size(), limit));
  bool last_space = false;
  for (char c : payload) {
    char v = (c == '\n' || c == '\r' || c == '\t') ? ' ' : c;
    if (v == ' ') {
      if (last_space) continue;
      last_space = true;
    } else {
      last_space = false;
    }
    out.push_back(v);
    if (out.size() >= limit) {
      out += "...";
      break;
    }
  }
  return out;
}

}  // namespace amber::console

