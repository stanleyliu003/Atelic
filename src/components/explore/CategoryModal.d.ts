import { FC } from 'react';
import { Activity } from '../../types/activity.types';

interface CategoryModalProps {
  visible: boolean;
  category: string;
  activities: Activity[];
  loading?: boolean;
  loadingMore?: boolean;
  onSave: (selectedActivities: Activity[], deselectedWishlistActivityIds?: string[]) => void;
  onClose: () => void;
  onGenerateMore?: (categoryName: string) => Promise<void>;
  wishlistActivities?: Activity[];
}

export const CategoryModal: FC<CategoryModalProps>;
