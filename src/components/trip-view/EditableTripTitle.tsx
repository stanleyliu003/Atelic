import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../../constants/Colors';

interface EditableTripTitleProps {
  title: string | null;
  defaultTitle: string;
  onSave: (newTitle: string) => void;
  editable: boolean;
}

export default function EditableTripTitle({
  title,
  defaultTitle,
  onSave,
  editable,
}: EditableTripTitleProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [localTitle, setLocalTitle] = useState(title || defaultTitle);
  const inputRef = useRef<TextInput>(null);

  // Update local title when prop changes
  useEffect(() => {
    if (title !== null) {
      setLocalTitle(title);
    } else {
      setLocalTitle(defaultTitle);
    }
  }, [title, defaultTitle]);

  const handlePress = () => {
    if (editable) {
      setIsEditing(true);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = localTitle.trim();

    // If empty, reset to default
    if (trimmed === '') {
      setLocalTitle(title || defaultTitle);
      return;
    }

    // Save if:
    // 1. Title is null (no custom title set) and user typed something different from default
    // 2. Title exists and user typed something different from current title
    if (title === null && trimmed !== defaultTitle) {
      console.log('[EditableTripTitle] Saving new custom title:', trimmed);
      onSave(trimmed);
    } else if (title !== null && trimmed !== title) {
      console.log('[EditableTripTitle] Updating existing title from', title, 'to', trimmed);
      onSave(trimmed);
    }
  };

  const handleSubmit = () => {
    handleBlur();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={styles.container}
      disabled={!editable}
    >
      {isEditing ? (
        <TextInput
          ref={inputRef}
          value={localTitle}
          onChangeText={setLocalTitle}
          onBlur={handleBlur}
          onSubmitEditing={handleSubmit}
          style={styles.input}
          placeholder={defaultTitle}
          placeholderTextColor={Colors.GRAY}
          returnKeyType="done"
          maxLength={50}
          selectTextOnFocus
        />
      ) : (
        <View style={styles.titleContainer}>
          <Text style={styles.title}>{localTitle || defaultTitle}</Text>
          {editable && (
            <Ionicons
              name="pencil"
              size={18}
              color={Colors.GRAY}
              style={styles.icon}
            />
          )}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 4,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontFamily: 'outfit-bold',
    color: '#111827',
    flex: 1,
    letterSpacing: -0.4,
    lineHeight: 26,
  },
  input: {
    fontSize: 20,
    fontFamily: 'outfit-bold',
    color: '#111827',
    padding: 0,
    margin: 0,
    letterSpacing: -0.4,
    lineHeight: 26,
    borderBottomWidth: 2,
    borderBottomColor: '#F36406',
  },
  icon: {
    marginLeft: 8,
    opacity: 0.4,
  },
});
