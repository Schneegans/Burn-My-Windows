SHELL := /bin/bash

JS_FILES = $(shell find -type f -and \( -name "*.js" \))
RESOURCE_FILES = $(shell find resources -mindepth 2 -type f)

.PHONY: zip install uninstall clean

zip: burn-my-windows@schneegans.github.com.zip

install: burn-my-windows@schneegans.github.com.zip
	gnome-extensions install "burn-my-windows@schneegans.github.com.zip" --force
	@echo "Extension installed successfully! Now restart the Shell ('Alt'+'F2', then 'r')."

uninstall:
	gnome-extensions uninstall "burn-my-windows@schneegans.github.com"

clean:
	rm -rf \
	burn-my-windows@schneegans.github.com.zip \
	resources/burn-my-windows.gresource \
	resources/burn-my-windows.gresource.xml \
	schemas/gschemas.compiled

burn-my-windows@schneegans.github.com.zip: schemas/gschemas.compiled resources/burn-my-windows.gresource $(JS_FILES)
	@# Check if the VERSION variable was passed and set version to it
	@if [[ "$(VERSION)" != "" ]]; then \
	  sed -i "s|  \"version\":.*|  \"version\": $(VERSION)|g" metadata.json; \
	fi
	@# TODO Maybe echo version number of the release that was built, in order to facilitate double-checking before publishing it?
	
	@echo "Packing zip file..."
	@rm --force burn-my-windows@schneegans.github.com.zip
	@zip -r burn-my-windows@schneegans.github.com.zip -- *.js src/*/*.js resources/burn-my-windows.gresource schemas/gschemas.compiled metadata.json LICENSE
	
	@#Check if the zip size is too big to be uploaded
	@if [[ "$$(stat -c %s burn-my-windows@schneegans.github.com.zip)" -gt 4096000 ]]; then \
	  echo "ERROR! The extension is too big to be uploaded to the extensions website, keep it smaller than 4096 KB!"; exit 1; \
	fi

resources/burn-my-windows.gresource: resources/burn-my-windows.gresource.xml
	@echo "Compiling resources..."
	@glib-compile-resources --sourcedir="resources" --generate resources/burn-my-windows.gresource.xml

resources/burn-my-windows.gresource.xml: $(RESOURCE_FILES)
	@echo "Creating resources xml..."
	@FILES=$$(find "resources" -mindepth 2 -type f -printf "%P\n" | xargs -i echo "<file>{}</file>") ; \
	echo "<?xml version='1.0' encoding='UTF-8'?><gresources><gresource> $$FILES </gresource></gresources>" > resources/burn-my-windows.gresource.xml

schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.burn-my-windows.gschema.xml
	@echo "Compiling schemas..."
	@glib-compile-schemas schemas