import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { debugSessionStorage } from '@/lib/supabase';
import { supabase } from '@/lib/supabase';

export const SessionDebugger: React.FC = () => {
  const { session, user, isLoading } = useAuth();

  const handleDebugStorage = async () => {
    console.log('🔍 Debugging session storage...');
    await debugSessionStorage();
  };

  const handleRefreshSession = async () => {
    console.log('🔄 Refreshing session...');
    const { data, error } = await supabase.auth.getSession();
    console.log('Session refresh result:', { data, error });
  };

  const handleClearStorage = async () => {
    console.log('🗑️ Clearing storage...');
    try {
      await supabase.auth.signOut();
      console.log('Storage cleared');
    } catch (error) {
      console.error('Error clearing storage:', error);
    }
  };

  if (__DEV__) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>🔍 Session Debugger (Dev Only)</Text>
        
        <View style={styles.infoContainer}>
          <Text style={styles.label}>Loading:</Text>
          <Text style={styles.value}>{isLoading ? 'Yes' : 'No'}</Text>
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.label}>Session:</Text>
          <Text style={styles.value}>{session ? 'Active' : 'None'}</Text>
        </View>
        
        <View style={styles.infoContainer}>
          <Text style={styles.label}>User:</Text>
          <Text style={styles.value}>{user ? user.email : 'None'}</Text>
        </View>
        
        <View style={styles.buttonContainer}>
          <TouchableOpacity style={styles.button} onPress={handleDebugStorage}>
            <Text style={styles.buttonText}>Debug Storage</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.button} onPress={handleRefreshSession}>
            <Text style={styles.buttonText}>Refresh Session</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={handleClearStorage}>
            <Text style={styles.buttonText}>Clear Storage</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return null;
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f0f0f0',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#333',
  },
  infoContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    color: '#666',
  },
  value: {
    color: '#333',
  },
  buttonContainer: {
    marginTop: 12,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  dangerButton: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: 'white',
    textAlign: 'center',
    fontWeight: '600',
  },
}); 