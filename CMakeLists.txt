cmake_minimum_required(VERSION 3.16)
project(amber_console LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

add_executable(amber-console
  native/src/main.cpp
  native/src/http_client.cpp
  native/src/http_server.cpp
  native/src/console_service.cpp
  native/src/memory_concierge_client.cpp
  native/src/json_util.cpp
)

target_include_directories(amber-console PRIVATE native/include)
target_compile_options(amber-console PRIVATE -Wall -Wextra -Wpedantic)

install(TARGETS amber-console RUNTIME DESTINATION bin)
install(DIRECTORY web/dist/ DESTINATION share/amber-console/web OPTIONAL)
