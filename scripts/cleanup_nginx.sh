#!/bin/bash

branch_name=$1

# Remove NGINX config
rm /etc/nginx/sites-available/$branch_name
rm /etc/nginx/sites-enabled/$branch_name

# Reload NGINX to apply changes
sudo systemctl reload nginx
