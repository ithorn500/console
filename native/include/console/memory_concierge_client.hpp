#pragma once

#include <chrono>
#include <string>

#include "console/http_server.hpp"

namespace amber::console {

Response memory_concierge_flow(std::chrono::milliseconds timeout);

}  // namespace amber::console
