#pragma once

#include <string>

namespace amber::console {

std::string json_escape(const std::string& value);
std::string now_utc_iso();
std::string json_string(const std::string& value);
std::string status_from_payload(int http_status, const std::string& payload);
std::string compact_preview(const std::string& payload, std::size_t limit);

}  // namespace amber::console

