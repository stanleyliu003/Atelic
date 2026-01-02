#!/bin/bash

# Post-pull hook to update OAuth domain for production environment
# Automatically runs after `amplify pull` completes successfully

# Read parameters from Amplify CLI
parameters=`cat`

# Check if there was an error during pull
if command -v jq &> /dev/null; then
    error=$(echo "$parameters" | jq -r '.error // empty')
    if [ ! -z "$error" ]; then
        echo "⚠️  Amplify pull had errors, skipping OAuth domain update"
        exit 0
    fi
fi

echo ""
echo "🔧 Running post-pull hook: OAuth domain update"
echo ""

# Run the OAuth domain update script
AMPLIFY_ENV=production node scripts/update-oauth-domain.js

exit 0
