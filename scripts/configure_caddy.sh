#!/bin/bash
port=$1
delete_flag=$2

caddyfile="/etc/caddy/Caddyfile"
subdomain="todoist.t7lab.com"
reverse_proxy_entry="${subdomain} {\n  reverse_proxy [::1]:${port}\n}\n"

if [[ "$delete_flag" == "--delete" ]]; then
    # Delete the existing entry for this subdomain
    if grep -q "${subdomain}" "$caddyfile"; then
        sudo sed -i "/${subdomain} {/,/}/d" "$caddyfile"
        echo "Deleted entry for ${subdomain}."
    else
        echo "No entry found for ${subdomain}."
    fi
else
  # Check if the branch is already present in the Caddyfile
  if grep -q "${subdomain}" "$caddyfile"; then
      # Use sed to replace the existing entry for this subdomain
      sudo sed -i "/${subdomain} {/,/}/c\\${reverse_proxy_entry}" "$caddyfile"
  else
      # Append a new entry at the end of the Caddyfile
      echo -e "$reverse_proxy_entry" | sudo tee -a "$caddyfile" > /dev/null
  fi
fi

# Reload Caddy to apply changes
sudo systemctl reload caddy
