import { useState, useCallback } from 'react';

/**
 * useLazyCarousel Hook
 *
 * Tracks which carousel slides have been viewed to enable lazy loading of images.
 * Only loads images for slides that have been scrolled to, reducing API costs
 * for Google Places photo requests.
 *
 * @param totalSlides - Total number of slides in the carousel
 * @param preloadRange - Number of adjacent slides to preload (default: 1 for smooth UX)
 * @returns Object with onSnapToItem callback and shouldLoad checker
 *
 * @example
 * const { onSnapToItem, shouldLoad } = useLazyCarousel(5);
 *
 * <Carousel
 *   onSnapToItem={onSnapToItem}
 *   renderItem={({ index }) => (
 *     <TripCarouselImage shouldLoad={shouldLoad(index)} />
 *   )}
 * />
 */
export function useLazyCarousel(totalSlides: number, preloadRange: number = 1) {
  // Initialize with first slide loaded (index 0)
  const [viewedIndices, setViewedIndices] = useState<Set<number>>(() => new Set([0]));

  /**
   * Called when carousel snaps to a new slide.
   * Marks the current slide and adjacent slides (within preloadRange) as viewable.
   */
  const onSnapToItem = useCallback((index: number) => {
    setViewedIndices(prev => {
      const next = new Set(prev);

      // Add current index and adjacent indices within preload range
      for (
        let i = Math.max(0, index - preloadRange);
        i <= Math.min(totalSlides - 1, index + preloadRange);
        i++
      ) {
        next.add(i);
      }

      // Only update state if new indices were added
      if (next.size === prev.size) {
        return prev;
      }

      return next;
    });
  }, [totalSlides, preloadRange]);

  /**
   * Checks if a slide at the given index should load its image.
   * Returns true if the slide has been viewed or is within preload range of a viewed slide.
   */
  const shouldLoad = useCallback((index: number): boolean => {
    return viewedIndices.has(index);
  }, [viewedIndices]);

  /**
   * Resets the viewed indices back to initial state (only first slide).
   * Useful when carousel data changes.
   */
  const reset = useCallback(() => {
    setViewedIndices(new Set([0]));
  }, []);

  return {
    onSnapToItem,
    shouldLoad,
    reset,
    // Expose for debugging/analytics
    viewedCount: viewedIndices.size,
    totalSlides
  };
}
