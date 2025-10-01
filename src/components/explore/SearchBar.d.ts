import { FC } from 'react';

interface SearchBarProps {
  value: string;
  onChangeText: (text: string) => void;
  onPress: () => void;
  placeholder?: string;
}

export const SearchBar: FC<SearchBarProps>;
