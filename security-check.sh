#!/bin/bash

# Security Check Script for Atelic App
# Run this before App Store submission

echo "🔍 Running Security Check..."
echo "================================"

# Check for hardcoded API keys in source code
echo "1. Checking for exposed API keys in source code..."
if grep -r "AIza" src/ app/ components/ 2>/dev/null | grep -v "process.env"; then
    echo "❌ FAIL: Found hardcoded API keys in source code!"
    exit 1
else
    echo "✅ PASS: No hardcoded API keys found in source code"
fi

# Check for AWS keys in client code (excluding auto-generated files)
echo "2. Checking for AWS keys in client code..."
if grep -r "da2-" src/ app/ components/ 2>/dev/null | grep -v "aws-exports.js" | grep -v "amplifyconfiguration.json"; then
    echo "❌ FAIL: Found AWS API keys in client code!"
    exit 1
else
    echo "✅ PASS: No AWS API keys found in client code (aws-exports.js and amplifyconfiguration.json are auto-generated and gitignored)"
fi

# Check if .env is properly gitignored
echo "3. Checking if .env files are gitignored..."
if [ -f .env ]; then
    # Check if .env file appears in git status as tracked (not deleted)
    if git status --porcelain | grep -E "^[^D].*\.env"; then
        echo "❌ FAIL: .env file is tracked by git!"
        exit 1
    else
        echo "✅ PASS: .env file exists and is properly gitignored"
    fi
else
    # Check if .env pattern is in .gitignore
    if grep -q "\.env" .gitignore; then
        echo "✅ PASS: .env pattern is in .gitignore (create .env file when ready)"
    else
        echo "❌ FAIL: .env pattern not found in .gitignore!"
        exit 1
    fi
fi

# Check if environment variables are being used
echo "4. Checking if environment variables are properly used..."
if grep -r "process.env.EXPO_PUBLIC_" src/ app/ components/ >/dev/null 2>&1; then
    echo "✅ PASS: Environment variables are being used"
else
    echo "⚠️  WARNING: No environment variables found - make sure they're properly configured"
fi

echo "================================"
echo "🎉 Security check completed!"
echo ""
echo "Next steps:"
echo "1. Create .env file with your API keys"
echo "2. Restrict API keys in Google Cloud Console"
echo "3. Test app with environment variables"
echo "4. Configure EAS build with production keys"
