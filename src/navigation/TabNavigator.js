import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { View, StyleSheet, Platform, Text } from 'react-native';
import DashboardScreen from '../screens/DashboardScreen';
import TransactionsScreen from '../screens/TransactionsScreen';
import CategoriesScreen from '../screens/CategoriesScreen';
import ProfileScreen from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

// Tab configuration for better maintainability
const TAB_CONFIG = {
  Dashboard: {
    icon: { focused: 'home', unfocused: 'home-outline' },
    label: 'Dashboard',
  },
  Transactions: {
    icon: { focused: 'receipt', unfocused: 'receipt-outline' },
    label: 'Transactions',
  },
  Categories: {
    icon: { focused: 'grid', unfocused: 'grid-outline' },
    label: 'Categories',
  },
  Profile: {
    icon: { focused: 'person', unfocused: 'person-outline' },
    label: 'Profile',
  },
};

// Reusable focused icon component
const FocusedIcon = ({ iconName }) => (
  <View style={[styles.executionIconContainer, styles.executionIconActive]}>
    <Ionicons name={iconName} size={30} color="#FFFFFF" />
  </View>
);

// Reusable label component
const TabLabel = ({ focused, color, label }) => {
  if (focused) return null;
  
  return (
    <Text style={[
      styles.tabLabel,
      { color }
    ]}>
      {label}
    </Text>
  );
};

const TabNavigator = () => {
  return (
    <Tab.Navigator
      initialRouteName="Dashboard"
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color }) => {
          const config = TAB_CONFIG[route.name];
          const iconName = focused ? config.icon.focused : config.icon.unfocused;
          
          // Show focused icon when tab is active
          if (focused) {
            return <FocusedIcon iconName={iconName} />;
          }
          
          // Show simple icon when not focused
          return <Ionicons name={iconName} size={24} color={color} />;
        },
        tabBarActiveTintColor: '#3B82F6',
        tabBarInactiveTintColor: '#9CA3AF',
        tabBarShowLabel: true,
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: '600',
          marginBottom: Platform.OS === 'ios' ? 0 : 10,
        },
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          height: Platform.OS === 'ios' ? 88 : 70, // Standard iPhone height with home indicator
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          // Subtle shadow to make it feel premium
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 20,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={({ route }) => ({
          title: TAB_CONFIG[route.name].label,
          tabBarLabel: ({ focused, color }) => (
            <TabLabel 
              focused={focused} 
              color={color} 
              label={TAB_CONFIG[route.name].label} 
            />
          ),
        })}
      />
      <Tab.Screen
        name="Transactions"
        component={TransactionsScreen}
        options={({ route }) => ({
          title: TAB_CONFIG[route.name].label,
          tabBarLabel: ({ focused, color }) => (
            <TabLabel 
              focused={focused} 
              color={color} 
              label={TAB_CONFIG[route.name].label} 
            />
          ),
        })}
      />
      <Tab.Screen
        name="Categories"
        component={CategoriesScreen}
        options={({ route }) => ({
          title: TAB_CONFIG[route.name].label,
          tabBarLabel: ({ focused, color }) => (
            <TabLabel 
              focused={focused} 
              color={color} 
              label={TAB_CONFIG[route.name].label} 
            />
          ),
        })}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={({ route }) => ({
          title: TAB_CONFIG[route.name].label,
          tabBarLabel: ({ focused, color }) => (
            <TabLabel 
              focused={focused} 
              color={color} 
              label={TAB_CONFIG[route.name].label} 
            />
          ),
        })}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  executionIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Platform.OS === 'ios' ? 20 : 30,
    borderWidth: 4,
    borderColor: '#F9FAFB',
    transition: 'all 0.3s ease',
  },
  executionIconActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#DBEAFE',
  },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: Platform.OS === 'ios' ? 0 : 10,
  },
});

export default TabNavigator;
