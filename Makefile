# TARGET NAMES
TARGET = VASimVis

# DIRECTORIES
VASIM = VASim
MNRL = $(VASIM)/libs/MNRL/C++
JSON11 = $(MNRL)/lib/json11
JSON = $(MNRL)/lib/valijson/thirdparty/nlohmann-json-1.1.0
PUGI = $(VASIM)/libs/pugixml/src

# DEPENDENCIES
LIBVASIM = $(VASIM)/libvasim.a
LIBMNRL = $(MNRL)/libmnrl.a
JSON11_HPP = $(JSON11)/json11.hpp

# FLAGS
IDIRS=-Iinclude -I$(MNRL)/include -I$(VASIM)/include -I$(PUGI) -I$(JSON) -I$(JSON11)

# LIBRARIES
# witty
WTLIBS=-lwthttp -lwt
# boost
BOOSTLIBS= -lboost_random -lboost_regex -lboost_signals -lboost_system -lboost_thread -lboost_filesystem -lboost_program_options -lboost_date_time

CXXFLAGS= -O3 -std=c++11 $(IDIRS) $(WTLIBS) $(BOOSTLIBS)

CC=g++

all: submodule_init auto_viewer

auto_viewer: vasim
	$(info )
	$(info Compiling Automata Playground...)
	$(MAKE) $(TARGET)

vasim:
	$(MAKE) -C $(VASIM)

$(TARGET): VASimVis.cc $(LIBVASIM) $(LIBMNRL)
	$(CC) -o $@ $^ $(CXXFLAGS)

.PHONY: clean cleanplay cleanvasim submodule_init auto_viewer run

clean: cleanplay cleanvasim

cleanplay:
	$(info )
	$(info Cleaning Automata Playground...)
	rm -f VASimVis

cleanvasim:
	cd VASim && $(MAKE) clean


submodule_init:
	$(info )
	$(info Updating submodules...)
	@git submodule update --init --recursive

run: all
	./run.sh
