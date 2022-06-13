#!/bin/sh

set -e

case $(uname -s) in
Darwin) os="macos" ;;
*) os="linux" ;;
esac

if [ "$os" = "linux" ]; then
	if [ $(cat /etc/os-release | grep "NAME=" | grep -ic "Alpine") = "0" ]; then
		# normal variant, i.e. ubuntu
	else
		# alpine variant
		os="alpine"
	fi
fi

case $(uname -m) in
x86_64) arch="x86_64" ;;
arm64) arch="arm64" ;;
*) arch="other" ;;
esac

if [ "$arch" = "other" ]; then
	echo "Unsupported architecture $(uname -m). Only x64 binaries are available."
	exit
fi

if [ $# -eq 0 ]; then
	locize_asset_path=$(
		command curl -sSf https://github.com/locize/locize-cli/releases |
			command grep -o "/locize/locize-cli/releases/download/.*/locize-${os}" |
			command head -n 1
	)
	if [ ! "$locize_asset_path" ]; then exit 1; fi
	locize_uri="https://github.com${locize_asset_path}"
else
	locize_uri="https://github.com/locize/locize-cli/releases/download/${1}/locize-${os}"
fi

locize_install=${locize_INSTALL:-$HOME/.locize-cli}
bin_dir="${locize_install}/bin"
exe="$bin_dir/locize"

if [ ! -d "$bin_dir" ]; then
	mkdir -p "$bin_dir"
fi

curl -fL# -o "$exe" "$locize_uri"
chmod +x "$exe"

echo "locize-cli (locize) was installed successfully to $exe"
if command -v deno >/dev/null; then
	echo "Run 'locize --help' to get started"
else
	echo "Manually add the directory to your \$HOME/.bash_profile (or similar)"
	echo "  export locize_INSTALL=\"$locize_install\""
	echo "  export PATH=\"\$locize_INSTALL/bin:\$PATH\""
	echo "Run '$exe --help' to get started"
fi
