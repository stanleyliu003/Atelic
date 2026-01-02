#!/bin/bash

# Check all TripOperation resolvers for CloudFormation bugs

echo "Checking all TripOperation resolvers for WishlistAnalysis reference bugs..."
echo ""

RESOLVERS=(
  "CreateTripOperationResolver"
  "UpdateTripOperationResolver"
  "DeleteTripOperationResolver"
  "GetTripOperationResolver"
  "ListTripOperationsResolver"
  "SubscriptiononCreateTripOperationResolver"
  "SubscriptiononUpdateTripOperationResolver"
  "SubscriptiononDeleteTripOperationResolver"
  "QuerylistOperationsByTripResolver"
)

for resolver in "${RESOLVERS[@]}"; do
  echo "=== Checking $resolver ==="

  # Check if resolver has WishlistAnalysis references
  if grep -A 20 "\"$resolver\"" amplify/backend/api/WishListAPI/build/stacks/TripOperation.json | grep -q "WishlistAnalysis"; then
    echo "❌ BUG FOUND: References WishlistAnalysis functions (should be TripOperation)"
  else
    echo "✅ OK: No WishlistAnalysis references"
  fi

  echo ""
done
