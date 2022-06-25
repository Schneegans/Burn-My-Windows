SHELL := /bin/bash

# We define these here to make the makefile easier to port to another extension.
NAME     := burn-my-windows
DOMAIN   := schneegans.github.com
ZIP_NAME := $(NAME)@$(DOMAIN).zip

# Some of the recipes below depend on some of these files.
JS_FILES       = $(shell find -type f -and \( -name "*.js" \))
UI_FILES       = $(shell find resources -type f -and \( -name "*.ui" \))
RESOURCE_FILES = $(shell find resources -mindepth 2 -type f)
LOCALES_PO     = $(wildcard po/*.po)
LOCALES_MO     = $(patsubst po/%.po,locale/%/LC_MESSAGES/$(NAME).mo,$(LOCALES_PO))

# These files will be included in the extension zip file.
ZIP_CONTENT = $(JS_FILES) $(LOCALES_MO) resources/$(NAME).gresource \
              schemas/gschemas.compiled metadata.json LICENSE

# These seven recipes can be invoked by the user.
.PHONY: zip install uninstall pot clean test references

# The zip recipes only bundles the extension without installing it.
zip: $(ZIP_NAME)

# The install recipes creates the extension zip and installs it.
install: $(ZIP_NAME)
	gnome-extensions install "$(ZIP_NAME)" --force
	@echo "Extension installed successfully! Now restart the Shell ('Alt'+'F2', then 'r')."

# This uninstalls the previously installed extension.
uninstall:
	gnome-extensions uninstall "$(NAME)@$(DOMAIN)"

# Use gettext to generate a translation template file.
pot: $(JS_FILES) $(UI_FILES)
	@echo "Generating '$(NAME).pot'..."
	@xgettext --from-code=UTF-8 \
	          --add-comments=Translators \
	          --copyright-holder="Simon Schneegans" \
	          --package-name="$(NAME)" \
	          --output=po/$(NAME).pot \
	          $(JS_FILES) $(UI_FILES)

# This runs several tests in containerized versions of GNOME Shell.
test:
	@ for version in 32 33 34 35 36 ; do \
	  for session in "gnome-xsession" "gnome-wayland-nested" ; do \
	    echo ; \
	    echo "Running Tests on Fedora $$version ($$session)." ; \
	    echo ; \
	    ./tests/run-test.sh -s $$session -v $$version ; \
	  done \
	done

# This re-generates all reference images required by the tests.
references:
	@ for version in 32 33 34 35 36 ; do \
	  for session in "gnome-xsession" "gnome-wayland-nested" ; do \
	    echo ; \
	    echo "Generating References for Fedora $$version ($$session)." ; \
	    echo ; \
	    ./tests/generate-references.sh -s $$session -v $$version ; \
	  done \
	done

# This removes all temporary files created with the other recipes.
clean:
	rm -rf $(ZIP_NAME) \
	       resources/$(NAME).gresource \
	       resources/$(NAME).gresource.xml \
	       schemas/gschemas.compiled \
	       locale

# This bundles the extension and checks whether it is small enough to be uploaded to
# extensions.gnome.org. We do not use "gnome-extensions pack" for this, as this is not
# readily available on the GitHub runners.
$(ZIP_NAME): $(ZIP_CONTENT)
	@echo "Packing zip file..."
	@rm --force $(ZIP_NAME)
	@zip $(ZIP_NAME) -- $(ZIP_CONTENT)

	@#Check if the zip size is too big to be uploaded
	@SIZE=$$(unzip -Zt $(ZIP_NAME) | awk '{print $$3}') ; \
	 if [[ $$SIZE -gt 5242880 ]]; then \
	    echo "ERROR! The extension is too big to be uploaded to" \
	         "the extensions website, keep it smaller than 5 MB!"; \
	    exit 1; \
	 fi

# Compiles the gschemas.compiled file from the gschema.xml file.
schemas/gschemas.compiled: schemas/org.gnome.shell.extensions.$(NAME).gschema.xml
	@echo "Compiling schemas..."
	@glib-compile-schemas schemas

# Compiles the gresource file from the gresources.xml.
resources/$(NAME).gresource: resources/$(NAME).gresource.xml
	@echo "Compiling resources..."
	@glib-compile-resources --sourcedir="resources" --generate resources/$(NAME).gresource.xml

# Generates the gresources.xml based on all files in the resources subdirectory.
resources/$(NAME).gresource.xml: $(RESOURCE_FILES)
	@echo "Creating resources xml..."
	@FILES=$$(find "resources" -mindepth 2 -type f -printf "%P\n" | xargs -i echo "<file>{}</file>") ; \
	 echo "<?xml version='1.0' encoding='UTF-8'?><gresources><gresource> $$FILES </gresource></gresources>" \
	     > resources/$(NAME).gresource.xml

# Compiles all *.po files to *.mo files.
locale/%/LC_MESSAGES/$(NAME).mo: po/%.po
	@echo "Compiling $@"
	@mkdir -p locale/$*/LC_MESSAGES
	@msgfmt -c -o $@ $<
