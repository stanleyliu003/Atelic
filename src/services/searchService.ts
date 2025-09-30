import { API, graphqlOperation } from 'aws-amplify';

interface SearchAutocompleteResponse {
  suggestions: string[];
}

/**
 * Get search autocomplete suggestions using Gemini AI
 * @param selectedCity - The city to search in
 * @param query - The user's search query
 * @param filters - Optional array of filter IDs (e.g., ['kid_friendly', 'budget_friendly'])
 * @returns Array of autocomplete suggestions
 */
export async function getSearchAutocomplete(
  selectedCity: string,
  query: string,
  filters: string[] = []
): Promise<string[]> {
  try {
    console.log('[getSearchAutocomplete] Making GraphQL call with params:', {
      selectedCity,
      query,
      filters
    });

    const result = await API.graphql(graphqlOperation(`
      query SearchAutocomplete($selectedCity: String!, $query: String!, $filters: [String!]) {
        searchAutocomplete(selectedCity: $selectedCity, query: $query, filters: $filters) {
          suggestions
        }
      }
    `, {
      selectedCity,
      query,
      filters
    })) as any;

    console.log('[getSearchAutocomplete] GraphQL response:', result?.data?.searchAutocomplete);

    return result?.data?.searchAutocomplete?.suggestions ?? [];
  } catch (error) {
    console.error('[getSearchAutocomplete] GraphQL error:', error);
    throw error;
  }
}