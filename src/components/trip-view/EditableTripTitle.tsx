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

    console.log('[EditableTripTitle] handleBlur called');
    console.log('[EditableTripTitle] Current title prop:', title);
    console.log('[EditableTripTitle] Local title:', localTitle);
    console.log('[EditableTripTitle] Trimmed:', trimmed);
    console.log('[EditableTripTitle] Default title:', defaultTitle);

    // If empty, reset to default
    if (trimmed === '') {
      setLocalTitle(title || defaultTitle);
      return;
    }

    // Save if:
    // 1. Title is null (no custom title set) and user typed something different from default
    // 2. Title exists and user typed something different from current title
    if (title === null && trimmed !== defaultTitle) {
      console.log('[EditableTripTitle] ✅ Saving new custom title:', trimmed);
      onSave(trimmed);
    } else if (title !== null && trimmed !== title) {
      console.log('[EditableTripTitle] ✅ Updating existing title from', title, 'to', trimmed);
      onSave(trimmed);
    } else {
      console.log('[EditableTripTitle] ❌ Not saving - title unchanged or matches default');
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
    fontSize: 24,
    fontFamily: 'outfit-bold',
    color: '#000000',
    flex: 1,
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  input: {
    fontSize: 24,
    fontFamily: 'outfit-bold',
    color: '#000000',
    padding: 0,
    margin: 0,
    letterSpacing: -0.4,
    lineHeight: 30,
    borderBottomWidth: 2,
    borderBottomColor: '#007AFF',
  },
  icon: {
    marginLeft: 10,
    opacity: 0.3,
  },
});
