import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator, TextInput, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { transactionApi, tagApi, categoryApi } from '../api';

const TransactionsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState([]);
  const [tags, setTags] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filters, setFilters] = useState({
    category: '',
    startDate: '',
    endDate: '',
    tags: ''
  });
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    fetchTransactions();
    fetchTags();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [currentPage, searchQuery, filters]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: limit,
        searchTerm: searchQuery,
        category: filters.category,
        tags: filters.tags,
        startDate: filters.startDate,
        endDate: filters.endDate
      };
      console.log('📞 Fetching Transactions with params:', params);
      const response = await transactionApi.getTransactions(params);
      console.log('📊 Transactions Count:', response?.data?.transactions?.length);
      console.log('📊 Total Count:', response?.data?.total);
      
      const transactionsArray = response?.data?.transactions || [];
      setTransactions(transactionsArray);
      setTotalCount(response?.data?.total || 0);
      
      if (transactionsArray.length === 0) {
        console.log('⚠️ No transactions found');
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTags = async () => {
    try {
      const response = await tagApi.getTags();
      setTags(response || []);
    } catch (error) {
      console.error('Error fetching tags:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await categoryApi.getCategories({ limit: 100 });
      const categoriesArray = response?.categories || [];
      setCategories(categoriesArray);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const handleEditTransaction = (transaction) => {
    setEditingTransaction(transaction);
    setShowEditModal(true);
  };

  const handleAddTransaction = () => {
    setShowAddModal(true);
  };

  const handleFilterPress = () => {
    setShowFilterModal(true);
  };

  const handleApplyFilters = () => {
    setCurrentPage(1);
    fetchTransactions();
    setShowFilterModal(false);
  };

  const handleClearFilters = () => {
    setFilters({
      category: '',
      startDate: '',
      endDate: '',
      tags: ''
    });
    setCurrentPage(1);
    fetchTransactions();
    setShowFilterModal(false);
  };

  const totalIncome = (transactions || [])
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount || 0), 0);
    
  const totalExpenses = (transactions || [])
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Math.abs(t.amount || 0), 0);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
          <Text style={styles.loadingText}>Loading transactions...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header with Search and Total */}
      <View style={styles.headerContainer}>
        <View style={styles.searchContainer}>
          <View style={styles.searchBox}>
            <Ionicons name="search" size={20} color="#6B7280" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search transactions..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={fetchTransactions}
            />
          </View>
          <TouchableOpacity style={styles.filterButton} onPress={handleFilterPress}>
            <Ionicons name="filter" size={20} color="#3B82F6" />
          </TouchableOpacity>
        </View>
        <View style={styles.totalContainer}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>${(totalIncome - totalExpenses).toFixed(2)}</Text>
        </View>
      </View>

      {/* Quick Filters */}
      <View style={styles.quickFiltersContainer}>
        <TouchableOpacity 
          style={[styles.quickFilter, filter === 'all' && styles.quickFilterActive]}
          onPress={() => setFilter('all')}
        >
          <Text style={[styles.quickFilterText, filter === 'all' && styles.quickFilterTextActive]}>All</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.quickFilter, filter === 'income' && styles.quickFilterActive]}
          onPress={() => setFilter('income')}
        >
          <Text style={[styles.quickFilterText, filter === 'income' && styles.quickFilterTextActive]}>Income</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.quickFilter, filter === 'expense' && styles.quickFilterActive]}
          onPress={() => setFilter('expense')}
        >
          <Text style={[styles.quickFilterText, filter === 'expense' && styles.quickFilterTextActive]}>Expenses</Text>
        </TouchableOpacity>
      </View>

      {/* Transactions List */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="receipt-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyStateTitle}>No Transactions Found</Text>
            <Text style={styles.emptyStateDescription}>
              Try adjusting your search or filters, or add your first transaction!
            </Text>
          </View>
        ) : (
          transactions.map((transaction, index) => (
            <TouchableOpacity key={transaction._id || index} style={styles.transactionCard}>
              {/* Header Row */}
              <View style={styles.cardHeader}>
                <View style={styles.cardLeft}>
                  <View style={[styles.typeIcon, { backgroundColor: transaction.type === 'income' ? '#10B981' : '#EF4444' }]}>
                    <Ionicons 
                      name={transaction.type === 'income' ? 'arrow-down' : 'arrow-up'} 
                      size={16} 
                      color="#FFFFFF" 
                    />
                  </View>
                  <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDescription} numberOfLines={2}>
                      {transaction.description || 'Transaction'}
                    </Text>
                  </View>
                </View>
                <View style={styles.cardRight}>
                  <Text style={[
                    styles.transactionAmount,
                    transaction.type === 'income' ? styles.incomeAmount : styles.expenseAmount
                  ]}>
                    {transaction.type === 'income' ? '+' : '-'}${Math.abs(transaction.amount || 0).toFixed(2)}
                  </Text>
                </View>
              </View>

              {/* Details Row */}
              <View style={styles.cardDetails}>
                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {new Date(transaction.createdAt || transaction.date).toLocaleDateString()}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="swap-horizontal-outline" size={14} color="#6B7280" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Type</Text>
                    <Text style={[
                      styles.detailValue,
                      transaction.type === 'income' ? styles.incomeText : styles.expenseText
                    ]}>
                      {transaction.type}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="folder-outline" size={14} color="#6B7280" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Category</Text>
                    <Text style={styles.detailValue}>
                      {transaction.category?.name || transaction.category || 'Uncategorized'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="card-outline" size={14} color="#6B7280" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Payment Mode</Text>
                    <Text style={styles.detailValue}>
                      {transaction.paymentMode || 'N/A'}
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="pricetag-outline" size={14} color="#6B7280" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Tags</Text>
                    <Text style={styles.detailValue}>
                      {transaction.tags && transaction.tags.length > 0 
                        ? transaction.tags.join(', ')
                        : 'None'
                      }
                    </Text>
                  </View>
                </View>

                <View style={styles.detailRow}>
                  <View style={styles.detailIcon}>
                    <Ionicons name="document-text-outline" size={14} color="#6B7280" />
                  </View>
                  <View style={styles.detailContent}>
                    <Text style={styles.detailLabel}>Note</Text>
                    <Text style={styles.detailValue}>
                      {transaction.note || 'No note'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Edit Button */}
              <TouchableOpacity 
                style={styles.editCardButton}
                onPress={() => handleEditTransaction(transaction)}
              >
                <Ionicons name="create-outline" size={14} color="#3B82F6" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Add Button */}
      <TouchableOpacity style={styles.addButton} onPress={handleAddTransaction}>
        <Ionicons name="add" size={24} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Pagination Controls */}
      {totalCount > limit && (
        <View style={styles.paginationContainer}>
          <TouchableOpacity 
            style={[styles.paginationButton, currentPage === 1 && styles.paginationButtonDisabled]}
            onPress={() => setCurrentPage(1)}
            disabled={currentPage === 1}
          >
            <Ionicons name="chevron-back" size={16} color={currentPage === 1 ? '#D1D5DB' : '#3B82F6'} />
          </TouchableOpacity>
          
          <View style={styles.paginationInfo}>
            <Text style={styles.paginationText}>
              Page {currentPage} of {Math.ceil(totalCount / limit)}
            </Text>
            <Text style={styles.paginationCount}>
              {transactions.length} of {totalCount} items
            </Text>
          </View>
          
          <TouchableOpacity 
            style={[styles.paginationButton, currentPage >= Math.ceil(totalCount / limit) && styles.paginationButtonDisabled]}
            onPress={() => setCurrentPage(currentPage + 1)}
            disabled={currentPage >= Math.ceil(totalCount / limit)}
          >
            <Ionicons name="chevron-forward" size={16} color={currentPage >= Math.ceil(totalCount / limit) ? '#D1D5DB' : '#3B82F6'} />
          </TouchableOpacity>
        </View>
      )}

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Filter Transactions</Text>
            <TouchableOpacity onPress={() => setShowFilterModal(false)}>
              <Ionicons name="close" size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterContent}>
            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Category</Text>
              <View style={styles.categorySelect}>
                <Text style={styles.selectText}>
                  {filters.category ? categories.find(c => c._id === filters.category)?.name : 'All Categories'}
                </Text>
                <Ionicons name="chevron-down" size={16} color="#6B7280" />
              </View>
            </View>

            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Start Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={filters.startDate}
                onChangeText={(text) => setFilters({...filters, startDate: text})}
              />
            </View>

            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>End Date</Text>
              <TextInput
                style={styles.dateInput}
                placeholder="YYYY-MM-DD"
                value={filters.endDate}
                onChangeText={(text) => setFilters({...filters, endDate: text})}
              />
            </View>

            <View style={styles.filterField}>
              <Text style={styles.filterLabel}>Tags</Text>
              <TextInput
                style={styles.textInput}
                placeholder="Enter tags..."
                value={filters.tags}
                onChangeText={(text) => setFilters({...filters, tags: text})}
              />
            </View>
          </View>

          <View style={styles.modalActions}>
            <TouchableOpacity style={styles.clearButton} onPress={handleClearFilters}>
              <Text style={styles.clearButtonText}>Clear</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApplyFilters}>
              <Text style={styles.applyButtonText}>Apply</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  
  // Header Styles
  headerContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  searchBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 14,
    color: '#1F2937',
  },
  filterButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  totalContainer: {
    alignItems: 'flex-end',
  },
  totalLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  totalAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1F2937',
  },

  // Quick Filters
  quickFiltersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  quickFilter: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#F3F4F6',
  },
  quickFilterActive: {
    backgroundColor: '#3B82F6',
  },
  quickFilterText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  quickFilterTextActive: {
    color: '#FFFFFF',
  },

  // Transaction Card Styles
  scrollView: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 16,
  },
  transactionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  typeIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
    transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 2,
  },
  transactionMeta: {
    fontSize: 11,
    color: '#6B7280',
  },
  cardRight: {
    alignItems: 'flex-end',
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  incomeAmount: {
    color: '#10B981',
  },
  expenseAmount: {
    color: '#EF4444',
  },

  // Card Details
  cardDetails: {
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  detailIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  detailContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  detailLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    minWidth: 60,
  },
  detailValue: {
    fontSize: 12,
    color: '#1F2937',
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },

  // Tags Styles
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  tag: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
  },
  tagText: {
    fontSize: 10,
    color: '#6B7280',
  },
  moreTagsText: {
    fontSize: 10,
    color: '#6B7280',
  },

  // Edit Card Button
  editCardButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Floating Add Button
  addButton: {
    position: 'absolute',
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },

  // Modal Styles
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingHorizontal: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  filterContent: {
    gap: 16,
  },
  filterField: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  categorySelect: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  selectText: {
    fontSize: 14,
    color: '#1F2937',
  },
  dateInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 14,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  clearButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    backgroundColor: '#3B82F6',
    alignItems: 'center',
  },
  applyButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  // Pagination Styles
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  paginationButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
  },
  paginationButtonDisabled: {
    backgroundColor: '#F9FAFB',
  },
  paginationInfo: {
    flex: 1,
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  paginationCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginLeft: 8,
  },

  // Empty State
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateDescription: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});

export default TransactionsScreen;
