import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transactionApi, dashboardApi, categoryApi } from '../api';

const { width } = Dimensions.get('window');

const DashboardScreen = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState(null);
  const [recentTransactions, setRecentTransactions] = useState([]);
  const [dashboardCards, setDashboardCards] = useState([]);
  const [dashboardChart, setDashboardChart] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [year, setYear] = useState(() => {
    const now = new Date();
    return now.getFullYear();
  });

  const handleMonthChange = (newMonth) => {
    setMonth(newMonth);
    fetchDashboardData();
  };

  const handleYearChange = (newYear) => {
    setYear(newYear);
    fetchDashboardData();
  };

  useEffect(() => {
    fetchDashboardData();
    // fetchRecentTransactions();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Fetch dashboard cards data
      const cardsResponse = await dashboardApi.getDashboardCards();
      setStats(cardsResponse);

      // Fetch dashboard chart data with month parameter
      const chartResponse = await dashboardApi.getDashboardChart({ month });
      console.log('📊 Chart API Response:', chartResponse);
      setChartData(chartResponse);

      // Fetch recent transactions
      const params = { limit: 5, page: 1 };
      const response = await transactionApi.getTransactions(params);
      console.log('📞 Recent Transactions Response:', response);
      const transactionsArray = response?.data?.transactions || [];
      setRecentTransactions(transactionsArray);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({ icon, title, value, change, changeType, color }) => (
    <View style={[styles.statCard, { backgroundColor: color }]}>
      <View style={styles.statIcon}>
        <Ionicons name={icon} size={24} color="#FFFFFF" />
      </View>
      <View style={styles.statContent}>
        <Text style={styles.statTitle}>{title}</Text>
        <Text style={styles.statValue}>{value}</Text>
        <Text style={[
          styles.statChange,
          changeType === 'positive' ? styles.positiveChange : styles.negativeChange
        ]}>
          {change}
        </Text>
      </View>
    </View>
  );

  const TransactionItem = ({ transaction }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionIcon}>
        <Ionicons 
          name={transaction.type === 'income' ? 'arrow-down-circle' : 'arrow-up-circle'} 
          size={16} 
          color={transaction.type === 'income' ? '#10B981' : '#EF4444'} 
        />
      </View>
      <View style={styles.transactionInfo}>
        <Text style={styles.transactionDescription}>
          {transaction.description || 'Transaction'}
        </Text>
        <Text style={styles.transactionMeta}>
          {transaction.category?.name || 'Uncategorized'} • {new Date(transaction.createdAt || transaction.date).toLocaleDateString()}
        </Text>
      </View>
      <View style={styles.transactionAmount}>
        <Text style={[
          styles.amountText,
          transaction.type === 'income' ? styles.incomeAmount : styles.expenseAmount
        ]}>
          {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount || 0).toFixed(2)}
        </Text>
      </View>
    </View>
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading dashboard...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <StatCard
          icon="wallet-outline"
          title="Total Balance"
          value={`$${stats?.totalBalance || 0}`}
          change={stats?.balanceChange || '+0%'}
          changeType="positive"
          color="#3B82F6"
        />
        <StatCard
          icon="arrow-down-circle-outline"
          title="Total Income"
          value={`$${stats?.totalIncome || 0}`}
          change={stats?.incomeChange || '+0%'}
          changeType="positive"
          color="#10B981"
        />
        <StatCard
          icon="arrow-up-circle-outline"
          title="Total Expenses"
          value={`$${stats?.totalExpenses || 0}`}
          change={stats?.expenseChange || '-0%'}
          changeType="negative"
          color="#EF4444"
        />
        <StatCard
          icon="trending-up-outline"
          title="Savings Rate"
          value={`${stats?.savingsRate || 0}%`}
          change={stats?.savingsChange || '+0%'}
          changeType="positive"
          color="#8B5CF"
        />
      </View>

      {/* Chart Section */}
      <View style={styles.chartSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Monthly Overview</Text>
          <View style={styles.dateSelectors}>
            <TouchableOpacity 
              style={styles.dateSelector} 
              onPress={() => setMonth(month)}
            >
              <Text style={styles.dateSelectorText}>
                {new Date(month + '-01').toLocaleDateString('en-US', { month: 'short' })}
              </Text>
              <Ionicons name="chevron-down" size={16} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.dateSelector} 
              onPress={() => setYear(year)}
            >
              <Text style={styles.dateSelectorText}>{year}</Text>
              <Ionicons name="chevron-down" size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
          <Ionicons name="bar-chart-outline" size={20} color="#6B7280" />
        </View>
        <View style={styles.chartContainer}>
          {chartData && chartData.data?.categories && chartData.data.categories.length > 0 ? (
            <View style={styles.chartDataDisplay}>
              <Text style={styles.chartTitle}>Spending by Category</Text>
              {chartData.data.categories.map((category, index) => (
                <TouchableOpacity key={index} style={styles.categoryItem}>
                  <View style={styles.categoryHeader}>
                    <View style={[styles.categoryDot, { backgroundColor: category.color || '#3B82F6' }]} />
                    <Text style={styles.categoryName}>{category._id || 'Uncategorized'}</Text>
                  </View>
                  <View style={styles.categoryDetails}>
                    <Text style={styles.categoryAmount}>${category.totalSpent || 0}</Text>
                    <Text style={styles.categoryPercentage}>
                      {((category.totalSpent / chartData.data.totalSpent) * 100).toFixed(1)}%
                    </Text>
                  </View>
                </TouchableOpacity>
            ))}
          </View>
              ):
              <View style={styles.emptyState}>
                <Ionicons name="bar-chart-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyStateTitle}>No Chart Data Available</Text>
                <Text style={styles.emptyStateSubtitle}>Try selecting a different month</Text>
              </View>
        }
        </View>

        {/* Recent Transactions */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
          </View>
          <ScrollView style={styles.transactionsList} showsVerticalScrollIndicator={false}>
            {recentTransactions.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
                <Text style={styles.emptyStateTitle}>No Recent Transactions</Text>
                <Text style={styles.emptyStateDescription}>
                  Your recent transactions will appear here
                </Text>
              </View>
            ) : (
              recentTransactions.map((transaction, index) => (
                <TransactionItem key={transaction._id || index} transaction={transaction} />
              ))
            )}
          </ScrollView>
        </View>
        </View>
      </SafeAreaView>
    );
  };

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  scrollView: {
    flex: 1,
  },
  balanceCard: {
    backgroundColor: '#3B82F6',
    margin: 16,
    borderRadius: 16,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  balanceHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: '#93C5FD',
    fontWeight: '500',
  },
  settingsButton: {
    padding: 8,
  },
  balanceAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  balanceChange: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  changeText: {
    fontSize: 14,
    color: '#93C5FD',
    fontWeight: '500',
    marginLeft: 4,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  statContent: {
    alignItems: 'center',
  },
  statAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  section: {
    margin: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  seeAllButton: {
    padding: 4,
  },
  seeAllText: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '500',
  },
  categoriesContainer: {
    gap: 12,
  },
  categoryItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  categoryDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  categoryName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  categoryDetails: {
    alignItems: 'flex-end',
  },
  categoryAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  categoryPercentage: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  transactionDetails: {
    flex: 1,
  },
  transactionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#6B7280',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '600',
  },
  income: {
    color: '#10B981',
  },
  expense: {
    color: '#EF4444',
  },
});

export default DashboardScreen;
