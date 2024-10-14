#!/bin/bash

port=$1

# Create NGINX config for the subdomain
cat <<EOT > /etc/nginx/sites-available/todoist
server {
    server_name todoist.t7lab.com;
    location / {
        proxy_pass http://localhost:$port;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOT

# Symlink to sites-enabled
[ ! -e /etc/nginx/sites-enabled/todoist ] && ln -s /etc/nginx/sites-available/todoist /etc/nginx/sites-enabled/

# Reload NGINX to apply changes
sudo systemctl reload nginx
