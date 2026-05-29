import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { categoryApi, transactionApi } from '../api';
import Header from '../components/Header';
import { showToast } from '../utils/toast';

const { width } = Dimensions.get('window');

const CategoriesScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [categories, setCategories] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalCategories, setTotalCategories] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const flatListRef = React.useRef(null);
  
  // Modal states
  const [isAddModalVisible, setIsAddModalVisible] = useState(false);
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);

  // Transaction modal states
  const [isTransactionModalVisible, setIsTransactionModalVisible] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalTransactions, setModalTransactions] = useState([]);
  const [modalLoading, setModalLoading] = useState(false);

  const fetchCategories = useCallback(async (isInitial = false) => {
    // Prevent multiple simultaneous fetches for the same data, but allow initial load
    if (loadingMore || (loading && !isInitial && !refreshing)) return;

    try {
      const currentPage = isInitial ? 1 : page;
      if (isInitial) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      const params = {
        page: currentPage,
        limit,
        searchTerm: searchQuery,
      };
      
      const response = await categoryApi.getCategories(params);
      
      if (response && response.data) {
        const newCategories = response.data.categories || [];
        if (currentPage === 1) {
          setCategories(newCategories);
        } else {
          setCategories(prev => {
            const existingIds = new Set(prev.map(c => c._id));
            const filteredNew = newCategories.filter(c => !existingIds.has(c._id));
            return [...prev, ...filteredNew];
          });
        }
        setTotalCategories(response.data.total || response.data.categories?.length || 0);
      }
    } catch (error) {
      console.error('Error fetching categories:', error);
      showToast.error('Error', 'Failed to fetch categories');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, limit, searchQuery, refreshing, loading, loadingMore]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && categories.length < totalCategories) {
      setPage(prev => prev + 1);
    }
  };

  useEffect(() => {
    fetchCategories(page === 1);
  }, [page, limit]);

  // Debounced search effect
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const onRefresh = () => {
    setRefreshing(true);
    if (page === 1) {
      fetchCategories(true); // Passes forceRefresh internally through page logic
    } else {
      setPage(1);
    }
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowBackToTop(offsetY > 400);
  };

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const handleAddCategory = async () => {
    if (!categoryName.trim()) {
      showToast.error('Validation', 'Please enter a category name');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await categoryApi.createCategory({ name: categoryName.trim() });
      if (response) {
        showToast.success('Success', 'Category created successfully');
        setIsAddModalVisible(false);
        setCategoryName('');
        // Always reset to page 1 to see the newest category
        setSearchQuery('');
        if (page === 1) {
          fetchCategories(1, limit, '');
        } else {
          setPage(1);
        }
      }
    } catch (error) {
      showToast.error('Error', error.response?.data?.message || 'Failed to create category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateCategory = async () => {
    if (!categoryName.trim()) {
      showToast.error('Validation', 'Please enter a category name');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await categoryApi.updateCategory({
        id: editingCategory._id,
        name: categoryName.trim(),
      });
      if (response) {
        showToast.success('Success', 'Category updated successfully');
        setIsEditModalVisible(false);
        setEditingCategory(null);
        setCategoryName('');
        fetchCategories();
      }
    } catch (error) {
      showToast.error('Error', error.response?.data?.message || 'Failed to update category');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteCategory = (category) => {
    Alert.alert(
      'Delete Category',
      `Are you sure you want to delete "${category.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await categoryApi.deleteCategory({ id: category._id });
              showToast.success('Deleted', 'Category removed successfully');
              fetchCategories();
            } catch (error) {
              showToast.error('Error', 'Failed to delete category');
            }
          },
        },
      ]
    );
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setCategoryName(category.name);
    setIsEditModalVisible(true);
  };

  const formatCurrency = (amount = 0) => `₹${Number(amount || 0).toLocaleString()}`;

  const fetchCategoryTransactions = async (category) => {
    setModalLoading(true);
    try {
      const response = await transactionApi.getTransactions({
        limit: 100,
        category: category._id,
        type: 'Expense',
      });
      setModalTransactions(response?.data?.transactions || []);
    } catch (error) {
      console.error('Error fetching category transactions:', error);
      showToast.error('Error', 'Failed to fetch transactions');
      setModalTransactions([]);
    } finally {
      setModalLoading(false);
    }
  };

  const openTransactionModal = (category) => {
    setSelectedCategory(category);
    setIsTransactionModalVisible(true);
    fetchCategoryTransactions(category);
  };

  const closeTransactionModal = () => {
    setIsTransactionModalVisible(false);
    setSelectedCategory(null);
    setModalTransactions([]);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(totalCategories / limit) || 1;

  const renderCategoryItem = ({ item: category }) => (
    <View style={styles.categoryCard}>
      <View style={styles.cardHeader}>
        <View style={styles.cardIconContainer}>
          <Ionicons name="folder-outline" size={22} color="#3B82F6" />
        </View>
        <View style={styles.cardTitleSection}>
          <Text style={styles.categoryTitle}>{category.name}</Text>
          <View style={styles.dateRow}>
            <Ionicons name="calendar-outline" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
            <Text style={styles.dateText}>Created: {formatDate(category.createdAt)}</Text>
          </View>
          <View style={styles.dateRow}>
            <Ionicons name="time-outline" size={12} color="#9CA3AF" style={{ marginRight: 4 }} />
            <Text style={styles.dateText}>Updated: {formatDate(category.updatedAt)}</Text>
          </View>
        </View>
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => openEditModal(category)}
          >
            <Ionicons name="create-outline" size={20} color="#3B82F6" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => handleDeleteCategory(category)}
          >
            <Ionicons name="trash-outline" size={20} color="#EF4444" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.totalsRow}>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Invested</Text>
          <Text style={[styles.totalValue, styles.investedValue]}>
            {formatCurrency(category.totalInvested)}
          </Text>
        </View>
        <View style={styles.totalCard}>
          <Text style={styles.totalLabel}>Spent</Text>
          <Text style={[styles.totalValue, styles.spentValue]}>
            {formatCurrency(category.totalSpent)}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.viewTransactionsButton}
        onPress={() => openTransactionModal(category)}
      >
        <Ionicons name="receipt-outline" size={18} color="#2563EB" />
        <Text style={styles.viewTransactionsText}>View Transactions</Text>
      </TouchableOpacity>
    </View>
  );

  const renderHeader = () => (
    <View>
      <Header title="Categories" />
      
      {/* Search and Limit Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search categories..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>
        
        <TouchableOpacity 
          style={styles.limitSelector}
          onPress={() => setShowLimitDropdown(!showLimitDropdown)}
        >
          <Text style={styles.limitText}>{limit} per page</Text>
          <Ionicons name={showLimitDropdown ? "chevron-up" : "chevron-down"} size={16} color="#64748B" />
        </TouchableOpacity>
      </View>

      {showLimitDropdown && (
        <View style={styles.limitDropdown}>
          {[10, 20, 50].map((val) => (
            <TouchableOpacity 
              key={val} 
              style={[styles.limitOption, limit === val && styles.limitOptionActive]}
              onPress={() => {
                setLimit(val);
                setPage(1);
                setShowLimitDropdown(false);
              }}
            >
              <Text style={[styles.limitOptionText, limit === val && styles.limitOptionTextActive]}>
                {val} items
              </Text>
              {limit === val && <Ionicons name="checkmark" size={16} color="#3B82F6" />}
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (loadingMore) {
      return (
        <View style={styles.loadMoreContainer}>
          <ActivityIndicator size="small" color="#3B82F6" />
        </View>
      );
    }
    // return <View style={{ height: 10 }} />;
  };

  const renderEmpty = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyIconContainer}>
          <Ionicons name="grid-outline" size={60} color="#DBEAFE" />
        </View>
        <Text style={styles.emptyTitle}>No Categories</Text>
        <Text style={styles.emptySubtitle}>
          {searchQuery ? "No categories match your search." : "You haven't added any categories yet."}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {renderHeader()}

      {loading && !refreshing && categories.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={renderEmpty}
          ListFooterComponent={renderFooter}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          onScroll={handleScroll}
          showsVerticalScrollIndicator={false}
        />
      )}

      {showBackToTop && (
        <TouchableOpacity style={styles.backToTopBtn} onPress={scrollToTop}>
          <Ionicons name="arrow-up" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Floating Action Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => {
          setCategoryName('');
          setIsAddModalVisible(true);
        }}
        activeOpacity={0.8}
      >
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal
        visible={isAddModalVisible || isEditModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setIsAddModalVisible(false);
          setIsEditModalVisible(false);
        }}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isAddModalVisible ? 'Add Category' : 'Edit Category'}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setIsAddModalVisible(false);
                  setIsEditModalVisible(false);
                }}
              >
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.inputLabel}>Category Name</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Enter name (e.g. Shopping)"
                value={categoryName}
                onChangeText={setCategoryName}
                autoFocus
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setIsAddModalVisible(false);
                  setIsEditModalVisible(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={isAddModalVisible ? handleAddCategory : handleUpdateCategory}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Category Transactions Modal */}
      <Modal
        visible={isTransactionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={closeTransactionModal}
      >
        <TouchableOpacity
          style={styles.transactionModalOverlay}
          activeOpacity={1}
          onPress={closeTransactionModal}
        >
          <TouchableOpacity activeOpacity={1} style={styles.transactionModalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{selectedCategory?.name}</Text>
                <Text style={styles.modalSubtitle}>All expense transactions</Text>
              </View>
              <TouchableOpacity onPress={closeTransactionModal}>
                <Ionicons name="close-circle" size={32} color="#64748B" />
              </TouchableOpacity>
            </View>

            {modalLoading ? (
              <ActivityIndicator size="large" color="#3B82F6" style={{ marginTop: 40 }} />
            ) : (
              <FlatList
                data={modalTransactions}
                keyExtractor={(item, index) => item._id || index.toString()}
                renderItem={({ item }) => (
                  <View style={styles.modalTransItem}>
                    <View style={styles.modalTransInfo}>
                      <Text style={styles.modalTransDate}>{formatDate(item.date)}</Text>
                      <Text style={styles.modalTransNote} numberOfLines={1}>
                        {item.note || 'No note'}
                      </Text>
                    </View>
                    <View style={styles.modalTransAmountSection}>
                      <Text style={styles.modalTransAmount}>{formatCurrency(item.amount)}</Text>
                      <Text style={styles.modalTransMode}>{item.paymentMode}</Text>
                    </View>
                  </View>
                )}
                ListEmptyComponent={
                  <Text style={styles.emptyModalText}>No expense transactions found for this category</Text>
                }
                contentContainerStyle={{ paddingBottom: 40 }}
                style={{ flex: 1 }}
              />
            )}

            <View style={styles.modalTotal}>
              <Text style={styles.modalTotalLabel}>Total Spent</Text>
              <Text style={styles.modalTotalValue}>
                {formatCurrency(modalTransactions.reduce((sum, item) => sum + item.amount, 0))}
              </Text>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  searchInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 16,
    color: '#1E293B',
  },
  limitSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    height: 48,
    borderRadius: 12,
    gap: 6,
  },
  limitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  limitDropdown: {
    position: 'absolute',
    top: 130,
    right: 20,
    width: 140,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 10,
    zIndex: 1000,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  limitOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
  },
  limitOptionActive: {
    backgroundColor: '#EFF6FF',
  },
  limitOptionText: {
    fontSize: 14,
    color: '#64748B',
  },
  limitOptionTextActive: {
    color: '#3B82F6',
    fontWeight: '600',
  },
  listContent: {
    padding: 20,
    paddingTop: 10,
  },
  categoryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#64748B',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#F1F5F9',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  cardIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  cardTitleSection: {
    flex: 1,
  },
  categoryTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  dateText: {
    fontSize: 12,
    color: '#64748B',
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionButton: {
    padding: 8,
    marginLeft: 4,
  },
  totalsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  totalCard: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  totalLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  totalValue: {
    fontSize: 16,
    fontWeight: '800',
  },
  investedValue: {
    color: '#059669',
  },
  spentValue: {
    color: '#DC2626',
  },
  viewTransactionsButton: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#EFF6FF',
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  viewTransactionsText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2563EB',
  },
  transactionModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'flex-end',
  },
  transactionModalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    height: '80%',
    padding: 24,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  modalTransItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  modalTransInfo: {
    flex: 1,
    marginRight: 12,
  },
  modalTransDate: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1E293B',
  },
  modalTransNote: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 4,
  },
  modalTransAmountSection: {
    alignItems: 'flex-end',
  },
  modalTransAmount: {
    fontSize: 16,
    fontWeight: '800',
    color: '#DC2626',
  },
  modalTransMode: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 4,
  },
  emptyModalText: {
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 14,
  },
  modalTotal: {
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
    paddingTop: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modalTotalLabel: {
    fontSize: 16,
    color: '#64748B',
    fontWeight: '600',
  },
  modalTotalValue: {
    fontSize: 24,
    fontWeight: '900',
    color: '#EF4444',
  },
  fab: {
    position: 'absolute',
    bottom: 30,
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 10,
    elevation: 8,
  },
  footerContainer: {
    marginTop: 10,
  },
  paginationContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  paginationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: 15,
  },
  paginationButtonDisabled: {
    backgroundColor: '#F1F5F9',
  },
  pageIndicator: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F8FAFC',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 400,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 30,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#1E293B',
  },
  modalBody: {
    marginBottom: 24,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748B',
    marginBottom: 8,
    marginLeft: 4,
  },
  modalInput: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    fontSize: 16,
    color: '#1E293B',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F1F5F9',
  },
  saveButton: {
    backgroundColor: '#3B82F6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748B',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  loadMoreContainer: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  backToTopBtn: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(59, 130, 246, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default CategoriesScreen;
