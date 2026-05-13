import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView, 
  TouchableOpacity, 
  ActivityIndicator, 
  Dimensions, 
  RefreshControl,
  Modal,
  FlatList,
  Platform
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transactionApi, dashboardApi } from '../api';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';

const { width } = Dimensions.get('window');

const DashboardScreen = ({ navigation }) => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Data States
  const [overallStats, setOverallStats] = useState({ totalIncome: 0, totalExpense: 0, totalSaving: 0 });
  const [summary, setSummary] = useState({ totalIncome: 0, totalSpent: 0, totalBalance: 0 });
  const [categories, setCategories] = useState([]);
  const [recentTransactions, setRecentTransactions] = useState([]);
  
  // Date States
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const [showDatePicker, setShowDatePicker] = useState(false);
  
  // Modal States
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTransactions, setModalTransactions] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      if (!refreshing) setLoading(true);
      console.log("Month", month);
      const [cardsRes, chartRes, transRes] = await Promise.all([
        dashboardApi.getDashboardCards(),
        dashboardApi.getDashboardChart({ month }),
        transactionApi.getTransactions({ limit: 5, page: 1 })
      ]);

      console.log('Chart Res', chartRes.data);
      console.log('Cards Res', cardsRes.data);
      console.log('Transactions Res', transRes.data);
      setOverallStats({
        totalIncome: cardsRes?.data?.totalIncome || 0,
        totalExpense: cardsRes?.data?.totalExpense || 0,
        totalSaving: cardsRes?.data?.totalSaving || 0,
      });

      // Summary from both cards and chart API
      setSummary({
        totalIncome: chartRes?.data?.totalIncome || 0,
        totalSpent: chartRes?.data?.totalSpent || 0,
        totalBalance: (chartRes?.data?.totalIncome || 0) - (chartRes?.data?.totalSpent || 0),
      });
      setCategories(chartRes?.data?.categories || []);
      setRecentTransactions(transRes?.data?.transactions || []);
      
    } catch (error) {
      console.error('Dashboard Fetch Error:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [month, refreshing]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  const handleBarPress = (category) => {
    setSelectedCategory(category);
    setIsModalOpen(true);
    fetchCategoryTransactions(category.id);
  };

  const fetchCategoryTransactions = async (categoryName) => {
    setModalLoading(true);
    try {
      const [year, monthNum] = month.split('-').map(Number);
      const startDate = new Date(year, monthNum - 1, 1).toISOString().split('T')[0];
      const endDate = new Date(year, monthNum, 0).toISOString().split('T')[0];

      const res = await transactionApi.getTransactions({
        limit: 50,
        searchTerm: '',
        category: categoryName, // Note: backend uses category name or ID depending on implementation
        startDate,
        endDate
      });
      setModalTransactions(res?.data?.transactions || []);
    } catch (error) {
      console.error('Modal Fetch Error:', error);
    } finally {
      setModalLoading(false);
    }
  };

  const renderOverallStats = () => (
    <View style={styles.overallContainer}>
      <Text style={styles.sectionHeaderTitle}>Overall Overview</Text>
      <View style={styles.overallGrid}>
        <View style={[styles.overallCard, { borderTopColor: '#3B82F6' }]}>
          <Text style={styles.overallLabel}>Total Income</Text>
          <Text style={[styles.overallValue, { color: '#3B82F6' }]}>₹{overallStats.totalIncome.toLocaleString()}</Text>
        </View>
        <View style={[styles.overallCard, { borderTopColor: '#EF4444' }]}>
          <Text style={styles.overallLabel}>Total Expense</Text>
          <Text style={[styles.overallValue, { color: '#EF4444' }]}>₹{overallStats.totalExpense.toLocaleString()}</Text>
        </View>
        <View style={[styles.overallCard, { borderTopColor: '#10B981' }]}>
          <Text style={styles.overallLabel}>Total Saving</Text>
          <Text style={[styles.overallValue, { color: '#10B981' }]}>₹{overallStats.totalSaving.toLocaleString()}</Text>
        </View>
      </View>
    </View>
  );

  const renderSummaryCards = () => (
    <View style={styles.summaryContainer}>
      <Text style={styles.sectionHeaderTitle}>Monthly Overview</Text>
      {/* Main Balance Card */}
      <View style={styles.balanceCard}>
        <View>
          <Text style={styles.balanceLabel}>Total Balance</Text>
          <Text style={styles.balanceAmount}>₹{summary.totalBalance.toLocaleString()}</Text>
        </View>
        <TouchableOpacity style={styles.monthSelector} onPress={() => setShowDatePicker(true)}>
          <Ionicons name="calendar" size={20} color="#FFFFFF" />
          <Text style={styles.monthText}>{moment(month, 'YYYY-MM').format('MMM YYYY')}</Text>
        </TouchableOpacity>
      </View>

      {/* Income & Expense Row */}
      <View style={styles.row}>
        <View style={[styles.miniCard, { borderLeftColor: '#10B981' }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#DCFCE7' }]}>
            <Ionicons name="arrow-down" size={20} color="#10B981" />
          </View>
          <View>
            <Text style={styles.miniLabel}>Income</Text>
            <Text style={[styles.miniValue, { color: '#059669' }]}>₹{summary.totalIncome.toLocaleString()}</Text>
          </View>
        </View>
        <View style={[styles.miniCard, { borderLeftColor: '#EF4444' }]}>
          <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
            <Ionicons name="arrow-up" size={20} color="#EF4444" />
          </View>
          <View>
            <Text style={styles.miniLabel}>Spent</Text>
            <Text style={[styles.miniValue, { color: '#DC2626' }]}>₹{summary.totalSpent.toLocaleString()}</Text>
          </View>
        </View>
      </View>
    </View>
  );

  const renderChart = () => {
    if (categories.length === 0) return (
      <View style={styles.emptyChart}>
        <Ionicons name="analytics" size={40} color="#E2E8F0" />
        <Text style={styles.emptyText}>No spending data for this month</Text>
      </View>
    );

    const maxSpent = Math.max(...categories.map(c => c.totalSpent), 1);

    return (
      <View style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Spending by Category</Text>
        <Text style={styles.sectionSubtitle}>Tap bars to see transactions</Text>
        
        {categories.map((item, index) => {
          const percentage = (item.totalSpent / maxSpent) * 100;
          const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
          const barColor = colors[index % colors.length];

          return (
            <TouchableOpacity 
              key={index} 
              style={styles.barWrapper}
              onPress={() => handleBarPress(item)}
            >
              <View style={styles.barHeader}>
                <Text style={styles.barLabel}>{item._id}</Text>
                <Text style={styles.barValue}>₹{item.totalSpent.toLocaleString()}</Text>
              </View>
              <View style={styles.barBackground}>
                <View style={[styles.barFill, { width: `${percentage}%`, backgroundColor: barColor }]} />
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderRecentTransactions = () => (
    <View style={styles.recentSection}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Recent Transactions</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Transactions')}>
          <Text style={styles.seeAll}>See All</Text>
        </TouchableOpacity>
      </View>
      
      {recentTransactions.length === 0 ? (
        <View style={styles.emptyRecent}>
          <Text style={styles.emptyText}>No transactions yet</Text>
        </View>
      ) : (
        recentTransactions.map((item, index) => (
          <View key={index} style={styles.transItem}>
            <View style={[styles.transIcon, { backgroundColor: item.type === 'Income' ? '#DCFCE7' : '#FEE2E2' }]}>
              <Ionicons 
                name={item.type === 'Income' ? 'add' : 'remove'} 
                size={20} 
                color={item.type === 'Income' ? '#10B981' : '#EF4444'} 
              />
            </View>
            <View style={styles.transInfo}>
              <Text style={styles.transTitle}>{item.category?.name || 'Other'}</Text>
              <Text style={styles.transDate}>{moment(item.date).format('DD MMM, YYYY')}</Text>
            </View>
            <Text style={[styles.transAmount, { color: item.type === 'Income' ? '#10B981' : '#EF4444' }]}>
              {item.type === 'Income' ? '+' : '-'}₹{item.amount.toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.userName}>Vault Flow User</Text>
          </View>
          <TouchableOpacity style={styles.profileBtn}>
            <Ionicons name="person-circle" size={40} color="#3B82F6" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loaderContainer}>
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <>
            {renderOverallStats()}
            {renderSummaryCards()}
            {renderChart()}
            {renderRecentTransactions()}
          </>
        )}
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <Modal transparent animationType="fade">
          <TouchableOpacity 
            style={styles.datePickerOverlay} 
            activeOpacity={1} 
            onPress={() => setShowDatePicker(false)}
          >
            <TouchableOpacity activeOpacity={1} style={styles.datePickerContainer}>
              <DateTimePicker
                value={new Date(month + '-01')}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, date) => {
                  if (date) {
                    setShowDatePicker(false);
                    const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    setMonth(newMonth);
                  }
                }}
              />
            </TouchableOpacity>
          </TouchableOpacity>
        </Modal>
      )}

      {/* Category Details Modal */}
      <Modal visible={isModalOpen} animationType="slide" transparent onRequestClose={() => setIsModalOpen(false)}>
        <TouchableOpacity 
          style={styles.modalOverlay} 
          activeOpacity={1} 
          onPress={() => setIsModalOpen(false)}
        >
          <TouchableOpacity activeOpacity={1} style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedCategory?._id}</Text>
                <Text style={styles.modalSubtitle}>{moment(month, 'YYYY-MM').format('MMMM YYYY')}</Text>
              </View>
              <TouchableOpacity onPress={() => setIsModalOpen(false)}>
                <Ionicons name="close-circle" size={32} color="#64748B" />
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={modalTransactions}
                keyExtractor={(item, index) => index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.modalTransItem}>
                    <View>
                      <Text style={styles.modalTransDate}>{moment(item.date).format('DD MMM')}</Text>
                      <Text style={styles.modalTransNote} numberOfLines={1}>{item.note || 'No note'}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.modalTransAmount}>₹{item.amount.toLocaleString()}</Text>
                      <Text style={styles.modalTransMode}>{item.paymentMode}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={<Text style={styles.emptyText}>No transactions found</Text>}
                contentContainerStyle={{ paddingBottom: 40 }}
              />
            )}
            
            <View style={styles.modalTotal}>
              <Text style={styles.totalLabel}>Total Spent</Text>
              <Text style={styles.totalValue}>₹{selectedCategory?.totalSpent.toLocaleString()}</Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  header: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    paddingHorizontal: 20, 
    paddingVertical: 15 
  },
  greeting: { fontSize: 14, color: '#64748B' },
  userName: { fontSize: 20, fontWeight: '800', color: '#1E293B' },
  loaderContainer: { height: 400, justifyContent: 'center', alignItems: 'center' },
  
  summaryContainer: { padding: 20 },
  balanceCard: { 
    backgroundColor: '#3B82F6', 
    borderRadius: 24, 
    padding: 24, 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10
  },
  balanceLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 14, fontWeight: '600' },
  balanceAmount: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 4 },
  monthSelector: { 
    backgroundColor: 'rgba(255,255,255,0.2)', 
    paddingHorizontal: 12, 
    paddingVertical: 8, 
    borderRadius: 12, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 6 
  },
  monthText: { color: '#FFFFFF', fontWeight: '700', fontSize: 12 },
  
  row: { flexDirection: 'row', gap: 12, marginTop: 16 },
  miniCard: { 
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 16, 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 12, 
    borderLeftWidth: 4 
  },
  iconCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  miniLabel: { fontSize: 12, color: '#64748B', fontWeight: '600' },
  miniValue: { fontSize: 16, fontWeight: '800' },
  
  chartCard: { backgroundColor: '#FFFFFF', marginHorizontal: 20, borderRadius: 24, padding: 20, marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B' },
  sectionSubtitle: { fontSize: 12, color: '#94A3B8', marginBottom: 20 },
  barWrapper: { marginBottom: 16 },
  barHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  barLabel: { fontSize: 14, color: '#475569', fontWeight: '600' },
  barValue: { fontSize: 14, fontWeight: '700', color: '#1E293B' },
  barBackground: { height: 8, backgroundColor: '#F1F5F9', borderRadius: 4, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 4 },
  emptyChart: { height: 150, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF', marginHorizontal: 20, marginBottom:20, borderRadius: 24, borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' },
  emptyText: { color: '#94A3B8', marginTop: 8, fontSize: 14 },

  recentSection: { paddingHorizontal: 20, marginBottom: 10 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  seeAll: { color: '#3B82F6', fontWeight: '700' },
  transItem: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  transIcon: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  transInfo: { flex: 1, marginLeft: 12 },
  transTitle: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  transDate: { fontSize: 12, color: '#94A3B8' },
  transAmount: { fontSize: 16, fontWeight: '800' },
  emptyRecent: { padding: 20, alignItems: 'center' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '80%', padding: 24 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#1E293B' },
  modalSubtitle: { fontSize: 14, color: '#64748B' },
  modalTransItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  modalTransDate: { fontSize: 15, fontWeight: '700', color: '#1E293B' },
  modalTransNote: { fontSize: 12, color: '#64748B', maxWidth: 150 },
  modalTransAmount: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
  modalTransMode: { fontSize: 11, color: '#94A3B8' },
  modalTotal: { borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { fontSize: 16, color: '#64748B', fontWeight: '600' },
  totalValue: { fontSize: 24, fontWeight: '900', color: '#EF4444' },

  // New Overall Styles
  overallContainer: { paddingHorizontal: 20, paddingTop: 10 },
  sectionHeaderTitle: { fontSize: 18, fontWeight: '800', color: '#1E293B', marginBottom: 12 },
  overallGrid: { flexDirection: 'row', gap: 10 },
  overallCard: { 
    flex: 1, 
    backgroundColor: '#FFFFFF', 
    borderRadius: 16, 
    padding: 12, 
    borderTopWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2
  },
  overallLabel: { fontSize: 10, color: '#64748B', fontWeight: '700', textTransform: 'uppercase', marginBottom: 4 },
  overallValue: { fontSize: 14, fontWeight: '800' },

  // Date Picker Modal Styles
  datePickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  datePickerContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    padding: 24,
    width: '100%',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
});

export default DashboardScreen;
