import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  TextInput,
  Alert,
  Dimensions,
  RefreshControl,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { transactionApi, categoryApi, tagApi } from '../api';
import Header from '../components/Header';
import { showToast } from '../utils/toast';

const { width } = Dimensions.get('window');

const TransactionsScreen = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const flatListRef = React.useRef(null);
  
  // Search and Pagination states
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [showLimitDropdown, setShowLimitDropdown] = useState(false);

  // Modal states
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isFilterModalVisible, setIsFilterModalVisible] = useState(false);
  const [showCategoryList, setShowCategoryList] = useState(false);
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states
  const [form, setForm] = useState({
    type: 'Expense',
    amount: '',
    category: '',
    paymentMode: 'UPI',
    date: new Date(),
    tags: [],
    note: '',
  });
  const [tagInput, setTagInput] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Filter states
  const [filters, setFilters] = useState({
    category: '',
    startDate: null,
    endDate: null,
    type: '',
    tags: '',
  });

  const [showFilterStartDatePicker, setShowFilterStartDatePicker] = useState(false);
  const [showFilterEndDatePicker, setShowFilterEndDatePicker] = useState(false);
  const [isFilterCategoryPickerVisible, setIsFilterCategoryPickerVisible] = useState(false);
  const [isFilterTagPickerVisible, setIsFilterTagPickerVisible] = useState(false);

  const fetchTransactions = useCallback(async (isInitial = false) => {
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
        category: filters.category,
        type: filters.type,
        tags: filters.tags,
        startDate: filters.startDate ? filters.startDate.toISOString().split('T')[0] : undefined,
        endDate: filters.endDate ? filters.endDate.toISOString().split('T')[0] : undefined,
      };
      
      const response = await transactionApi.getTransactions(params);
      
      if (response && response.data) {
        const newTransactions = response.data.transactions || [];
        if (currentPage === 1) {
          setTransactions(newTransactions);
        } else {
          // Append only if these are new items to avoid duplicates
          setTransactions(prev => {
            const existingIds = new Set(prev.map(t => t._id));
            const filteredNew = newTransactions.filter(t => !existingIds.has(t._id));
            return [...prev, ...filteredNew];
          });
        }
        setTotalTransactions(response.data.total || 0);
        setTotalExpenses(response.data.totalExpanses || 0);
      }
    } catch (error) {
      console.error('Error fetching transactions:', error);
      showToast.error('Error', 'Failed to fetch transactions');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  }, [page, limit, searchQuery, filters, refreshing, loading, loadingMore]);

  const handleLoadMore = () => {
    if (!loading && !loadingMore && transactions.length < totalTransactions) {
      setPage(prev => prev + 1);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDependencies(true); // Force refresh cache on pull-to-refresh
    if (page === 1) {
      fetchTransactions(true);
    } else {
      setPage(1);
    }
  };

  const handleScroll = (event) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    setShowBackToTop(offsetY > 500);
  };

  const scrollToTop = () => {
    flatListRef.current?.scrollToOffset({ offset: 0, animated: true });
  };

  const fetchDependencies = async (forceRefresh = false) => {
    try {
      const [catRes, tagRes] = await Promise.all([
        categoryApi.getCategories({ limit: 100 }, forceRefresh),
        tagApi.getTags(forceRefresh)
      ]);
      
      // Handle both { data: { categories } } and { categories } structures
      const fetchedCategories = catRes?.data?.categories || catRes?.categories || [];
      console.log('Fetched Categories:', fetchedCategories.length);
      setCategories(fetchedCategories);
      
      // Handle tags (usually returns array directly or inside data)
      setTags(Array.isArray(tagRes) ? tagRes : (tagRes?.data || []));
    } catch (error) {
      console.error('Error fetching dependencies:', error);
    }
  };

  // Main fetch effect
  useEffect(() => {
    // If it's a fresh search or filter, we should have reset the page to 1
    // This effect handles all data loading based on state changes
    fetchTransactions(page === 1);
  }, [page, limit, filters]);

  useEffect(() => {
    fetchDependencies();
  }, []);

  // Debounced search effect - ONLY resets page to 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      // The main fetch effect above will pick up the page=1 change and trigger the fetch
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleOpenModal = (transaction = null) => {
    setShowCategoryList(false);
    if (transaction) {
      setEditingTransaction(transaction);
      setForm({
        type: transaction.type || 'Expense',
        amount: transaction.amount?.toString() || '',
        category: transaction.category?._id || transaction.category || '',
        paymentMode: transaction.paymentMode || 'UPI',
        date: transaction.date ? new Date(transaction.date) : new Date(),
        tags: transaction.tags || [],
        note: transaction.note || '',
      });
    } else {
      setEditingTransaction(null);
      setForm({
        type: 'Expense',
        amount: '',
        category: '',
        paymentMode: 'UPI',
        date: new Date(),
        tags: [],
        note: '',
      });
    }
    setIsModalVisible(true);
  };

  const handleSaveTransaction = async () => {
    if (!form.amount || !form.category || !form.type) {
      showToast.error('Validation', 'Please fill in all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      const data = {
        ...form,
        amount: parseFloat(form.amount),
        date: form.date.toISOString(),
      };

      let response;
      if (editingTransaction) {
        response = await transactionApi.updateTransaction({ id: editingTransaction._id, ...data });
      } else {
        response = await transactionApi.createTransaction(data);
      }

      if (response) {
        showToast.success('Success', `Transaction ${editingTransaction ? 'updated' : 'created'} successfully`);
        setIsModalVisible(false);
        // Refresh by resetting to page 1
        if (page === 1) fetchTransactions(true);
        else setPage(1);
      }
    } catch (error) {
      showToast.error('Error', error.response?.data?.message || 'Failed to save transaction');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTransaction = (transaction) => {
    Alert.alert(
      'Delete Transaction',
      'Are you sure you want to delete this transaction?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await transactionApi.deleteTransaction({ id: transaction._id });
              showToast.success('Deleted', 'Transaction removed successfully');
              fetchTransactions();
            } catch (error) {
              showToast.error('Error', 'Failed to delete transaction');
            }
          },
        },
      ]
    );
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags.includes(tagInput.trim())) {
      setForm({ ...form, tags: [...form.tags, tagInput.trim()] });
      setTagInput('');
    }
  };

  const removeTag = (tag) => {
    setForm({ ...form, tags: form.tags.filter(t => t !== tag) });
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const totalPages = Math.ceil(totalTransactions / limit) || 1;

  const renderTransactionItem = ({ item }) => (
    <View style={styles.transactionCard}>
      <View style={styles.cardHeader}>
        <View style={[styles.typeIconContainer, { backgroundColor: item.type === 'Income' ? '#ECFDF5' : '#FEF2F2' }]}>
          <Ionicons 
            name={item.type === 'Income' ? 'arrow-down' : 'arrow-up'} 
            size={20} 
            color={item.type === 'Income' ? '#10B981' : '#EF4444'} 
          />
        </View>
        <View style={styles.cardTitleSection}>
          <Text style={styles.transactionTitle}>{item.category?.name || 'Uncategorized'}</Text>
          <Text style={styles.transactionDate}>{formatDate(item.date)}</Text>
        </View>
        <View style={styles.amountSection}>
          <Text style={[styles.amountText, { color: item.type === 'Income' ? '#10B981' : '#EF4444' }]}>
            {item.type === 'Income' ? '+' : '-'}${Math.abs(item.amount).toFixed(2)}
          </Text>
          <Text style={styles.paymentModeText}>{item.paymentMode}</Text>
        </View>
      </View>
      
      {item.note ? (
        <View style={styles.noteSection}>
          <Text style={styles.noteText} numberOfLines={1}>{item.note}</Text>
        </View>
      ) : null}

      {item.tags && item.tags.length > 0 ? (
        <View style={styles.tagsDisplay}>
          {item.tags.map((tag, i) => (
            <View key={i} style={styles.displayTag}>
              <Text style={styles.displayTagText}>{tag}</Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.cardActions}>
        <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleOpenModal(item)}>
          <Ionicons name="create-outline" size={18} color="#3B82F6" />
          <Text style={styles.cardActionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.cardActionBtn} onPress={() => handleDeleteTransaction(item)}>
          <Ionicons name="trash-outline" size={18} color="#EF4444" />
          <Text style={[styles.cardActionText, { color: '#EF4444' }]}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Header title="Transactions" />
      <View style={styles.searchSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color="#6B7280" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity 
          style={styles.limitSelector}
          onPress={() => setShowLimitDropdown(!showLimitDropdown)}
        >
          <Text style={styles.limitText}>{limit}</Text>
          <Ionicons name="chevron-down" size={16} color="#64748B" />
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.filterBtn, (filters.category || filters.type || filters.startDate) && styles.filterBtnActive]}
          onPress={() => setIsFilterModalVisible(true)}
        >
          <Ionicons name="filter-outline" size={20} color={filters.category || filters.type || filters.startDate ? "#FFFFFF" : "#64748B"} />
        </TouchableOpacity>
      </View>

      {showLimitDropdown && (
        <View style={styles.limitDropdown}>
          {[10, 20, 50].map((val) => (
            <TouchableOpacity 
              key={val} 
              style={styles.limitOption}
              onPress={() => {
                setLimit(val);
                setPage(1);
                setShowLimitDropdown(false);
              }}
            >
              <Text style={[styles.limitOptionText, limit === val && styles.limitOptionTextActive]}>{val} items</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );

  const renderFooter = () => {
    if (totalPages <= 1) return <View style={{ height: 80 }} />;
    return (
      <View style={styles.pagination}>
        <TouchableOpacity 
          style={[styles.pageBtn, page === 1 && styles.pageBtnDisabled]}
          onPress={() => setPage(p => Math.max(1, p - 1))}
          disabled={page === 1}
        >
          <Ionicons name="chevron-back" size={20} color={page === 1 ? "#CBD5E1" : "#3B82F6"} />
        </TouchableOpacity>
        <Text style={styles.pageInfo}>Page {page} of {totalPages}</Text>
        <TouchableOpacity 
          style={[styles.pageBtn, page === totalPages && styles.pageBtnDisabled]}
          onPress={() => setPage(p => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
        >
          <Ionicons name="chevron-forward" size={20} color={page === totalPages ? "#CBD5E1" : "#3B82F6"} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      {renderHeader()}

      {/* Summary Header */}
      {!loading && transactions.length > 0 && (
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <View style={styles.summaryIconBox}>
              <Ionicons name="receipt-outline" size={24} color="#EF4444" />
            </View>
            <View>
              <Text style={styles.summaryLabel}>Total Expenses</Text>
              <Text style={styles.summaryValue}>₹{totalExpenses.toLocaleString()}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{totalTransactions} Items</Text>
            </View>
          </View>
        </View>
      )}

      {loading && !refreshing && transactions.length === 0 ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#3B82F6" />
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={transactions}
          renderItem={renderTransactionItem}
          keyExtractor={(item, index) => item._id || index.toString()}
          contentContainerStyle={styles.listContent}
          onScroll={handleScroll}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#3B82F6']} />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={() => (
            loadingMore ? (
              <View style={styles.loadMoreContainer}>
                <ActivityIndicator size="small" color="#3B82F6" />
              </View>
            ) : null
          )}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="receipt-outline" size={60} color="#DBEAFE" />
              <Text style={styles.emptyTitle}>No Transactions</Text>
              <Text style={styles.emptySubtitle}>Try adjusting your search or filters.</Text>
            </View>
          }
        />
      )}

      {showBackToTop && (
        <TouchableOpacity style={styles.backToTopBtn} onPress={scrollToTop}>
          <Ionicons name="arrow-up" size={24} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      <TouchableOpacity style={styles.fab} onPress={() => handleOpenModal()}>
        <Ionicons name="add" size={30} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Add/Edit Modal */}
      <Modal visible={isModalVisible} transparent animationType="slide" onRequestClose={() => setIsModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingTransaction ? 'Edit Transaction' : 'Add Transaction'}</Text>
              <TouchableOpacity onPress={() => setIsModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {showCategoryList ? (
              <View style={styles.categoryListContainer}>
                <View style={styles.modalSearchBox}>
                  <Ionicons name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search category..."
                    value={categorySearchQuery}
                    onChangeText={setCategorySearchQuery}
                    autoFocus={true}
                  />
                  <TouchableOpacity onPress={() => setShowCategoryList(false)}>
                    <Text style={styles.closePickerText}>Done</Text>
                  </TouchableOpacity>
                </View>

                <FlatList
                  data={categories.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.categoryItem, form.category === item._id && styles.categoryItemActive]}
                      onPress={() => {
                        setForm({ ...form, category: item._id });
                        setShowCategoryList(false);
                      }}
                    >
                      <Text style={[styles.categoryItemText, form.category === item._id && styles.categoryItemTextActive]}>
                        {item.name}
                      </Text>
                      {form.category === item._id && <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.emptySearchText}>No categories found</Text>}
                />
              </View>
            ) : (
              <FlatList
                data={[1]}
                keyExtractor={(item) => item.toString()}
                renderItem={() => (
                  <View style={styles.modalBody}>
                  {/* Type Selector */}
                  <Text style={styles.label}>Type *</Text>
                  <View style={styles.typeSelector}>
                    {['Income', 'Expense', 'Saving'].map((type) => (
                      <TouchableOpacity 
                        key={type}
                        style={[styles.typeOption, form.type === type && styles.typeOptionActive]}
                        onPress={() => setForm({ ...form, type })}
                      >
                        <Text style={[styles.typeOptionText, form.type === type && styles.typeOptionTextActive]}>{type}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <Text style={styles.label}>Amount *</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="e.g. 1000"
                    keyboardType="numeric"
                    value={form.amount}
                    onChangeText={(text) => setForm({ ...form, amount: text })}
                  />

                  <Text style={styles.label}>Main Category *</Text>
                  <TouchableOpacity 
                    style={styles.dropdownTrigger} 
                    onPress={() => {
                      setCategorySearchQuery('');
                      setShowCategoryList(true);
                    }}
                  >
                    <Text style={[styles.dropdownText, !form.category && { color: '#94A3B8' }]}>
                      {categories.find(c => c._id === form.category)?.name || 'Select Category'}
                    </Text>
                    <Ionicons name="chevron-down" size={20} color="#64748B" />
                  </TouchableOpacity>

                  <View style={styles.row}>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={styles.label}>Payment Mode *</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modeScroll}>
                        {['Cash', 'Card', 'UPI', 'Wallet', 'Bank Transfer', 'Other'].map((mode) => (
                          <TouchableOpacity 
                            key={mode}
                            style={[styles.modePill, form.paymentMode === mode && styles.modePillActive]}
                            onPress={() => setForm({ ...form, paymentMode: mode })}
                          >
                            <Text style={[styles.modePillText, form.paymentMode === mode && styles.modePillTextActive]}>{mode}</Text>
                          </TouchableOpacity>
                        ))}
                      </ScrollView>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.label}>Date *</Text>
                      <TouchableOpacity style={styles.input} onPress={() => setShowDatePicker(true)}>
                        <Text style={{ color: '#1E293B' }}>{formatDate(form.date)}</Text>
                        <Ionicons name="calendar-outline" size={18} color="#64748B" style={styles.inputIcon} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {showDatePicker && (
                    <DateTimePicker
                      value={form.date}
                      mode="date"
                      display="default"
                      onChange={(event, selectedDate) => {
                        setShowDatePicker(Platform.OS === 'ios');
                        if (selectedDate) setForm({ ...form, date: selectedDate });
                      }}
                    />
                  )}

                  <Text style={styles.label}>Tags</Text>
                  <View style={styles.tagInputContainer}>
                    <TextInput
                      style={[styles.input, { flex: 1 }]}
                      placeholder="Press Enter to add"
                      value={tagInput}
                      onChangeText={setTagInput}
                      onSubmitEditing={addTag}
                    />
                    <TouchableOpacity style={styles.addTagBtn} onPress={addTag}>
                      <Ionicons name="add" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.tagsList}>
                    {form.tags.map((tag) => (
                      <View key={tag} style={styles.tagPill}>
                        <Text style={styles.tagText}>{tag}</Text>
                        <TouchableOpacity onPress={() => removeTag(tag)}>
                          <Ionicons name="close-circle" size={16} color="#64748B" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.label}>Note</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    placeholder="Add a note..."
                    multiline
                    numberOfLines={3}
                    value={form.note}
                    onChangeText={(text) => setForm({ ...form, note: text })}
                  />
                </View>
              )}
              showsVerticalScrollIndicator={false}
            />
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setIsModalVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleSaveTransaction} disabled={isSubmitting}>
                {isSubmitting ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.saveBtnText}>Save</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Filter Modal */}
      <Modal visible={isFilterModalVisible} transparent animationType="slide" onRequestClose={() => setIsFilterModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Transactions</Text>
              <TouchableOpacity onPress={() => setIsFilterModalVisible(false)}>
                <Ionicons name="close" size={24} color="#64748B" />
              </TouchableOpacity>
            </View>

            {isFilterCategoryPickerVisible ? (
              <View style={styles.categoryListContainer}>
                <View style={styles.modalSearchBox}>
                  <Ionicons name="search-outline" size={18} color="#94A3B8" />
                  <TextInput
                    style={styles.modalSearchInput}
                    placeholder="Search category..."
                    value={categorySearchQuery}
                    onChangeText={setCategorySearchQuery}
                    autoFocus={true}
                  />
                  <TouchableOpacity onPress={() => setIsFilterCategoryPickerVisible(false)}>
                    <Text style={styles.closePickerText}>Done</Text>
                  </TouchableOpacity>
                </View>
                <FlatList
                  data={categories.filter(c => c.name.toLowerCase().includes(categorySearchQuery.toLowerCase()))}
                  keyExtractor={(item) => item._id}
                  renderItem={({ item }) => (
                    <TouchableOpacity 
                      style={[styles.categoryItem, filters.category === item._id && styles.categoryItemActive]}
                      onPress={() => {
                        setFilters({ ...filters, category: item._id });
                        setIsFilterCategoryPickerVisible(false);
                      }}
                    >
                      <Text style={[styles.categoryItemText, filters.category === item._id && styles.categoryItemTextActive]}>
                        {item.name}
                      </Text>
                      {filters.category === item._id && <Ionicons name="checkmark-circle" size={20} color="#3B82F6" />}
                    </TouchableOpacity>
                  )}
                  ListEmptyComponent={<Text style={styles.emptySearchText}>No categories found</Text>}
                />
              </View>
            ) : (
              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                <Text style={styles.label}>Transaction Type</Text>
                <View style={styles.typeSelector}>
                  {['Income', 'Expense', 'Saving', ''].map((t) => (
                    <TouchableOpacity 
                      key={t}
                      style={[styles.typeOption, filters.type === t && styles.typeOptionActive]}
                      onPress={() => setFilters({ ...filters, type: t })}
                    >
                      <Text style={[styles.typeOptionText, filters.type === t && styles.typeOptionTextActive]}>{t || 'All'}</Text>
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.label}>Category</Text>
                <TouchableOpacity 
                  style={styles.dropdownTrigger} 
                  onPress={() => {
                    setCategorySearchQuery('');
                    setIsFilterCategoryPickerVisible(true);
                  }}
                >
                  <Text style={[styles.dropdownText, !filters.category && { color: '#94A3B8' }]}>
                    {categories.find(c => c._id === filters.category)?.name || 'Select Category'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#64748B" />
                </TouchableOpacity>

                <Text style={styles.label}>Tag</Text>
                <TouchableOpacity 
                  style={styles.dropdownTrigger} 
                  onPress={() => setIsFilterTagPickerVisible(true)}
                >
                  <Text style={[styles.dropdownText, !filters.tags && { color: '#94A3B8' }]}>
                    {filters.tags || 'Select Tag'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color="#64748B" />
                </TouchableOpacity>

                <View style={styles.row}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.label}>Start Date</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowFilterStartDatePicker(true)}>
                      <Text style={{ color: filters.startDate ? '#1E293B' : '#94A3B8' }}>
                        {filters.startDate ? formatDate(filters.startDate) : 'dd-mm-yyyy'}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text style={styles.label}>End Date</Text>
                    <TouchableOpacity style={styles.input} onPress={() => setShowFilterEndDatePicker(true)}>
                      <Text style={{ color: filters.endDate ? '#1E293B' : '#94A3B8' }}>
                        {filters.endDate ? formatDate(filters.endDate) : 'dd-mm-yyyy'}
                      </Text>
                      <Ionicons name="calendar-outline" size={18} color="#64748B" />
                    </TouchableOpacity>
                  </View>
                </View>

                {showFilterStartDatePicker && (
                  <DateTimePicker
                    value={filters.startDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowFilterStartDatePicker(Platform.OS === 'ios');
                      if (date) setFilters({ ...filters, startDate: date });
                    }}
                  />
                )}

                {showFilterEndDatePicker && (
                  <DateTimePicker
                    value={filters.endDate || new Date()}
                    mode="date"
                    display="default"
                    onChange={(event, date) => {
                      setShowFilterEndDatePicker(Platform.OS === 'ios');
                      if (date) setFilters({ ...filters, endDate: date });
                    }}
                  />
                )}

                {/* Filter Tag Picker Modal */}
                {isFilterTagPickerVisible && (
                  <Modal visible={isFilterTagPickerVisible} transparent animationType="slide">
                    <View style={styles.modalOverlay}>
                      <View style={[styles.modalContent, { height: '60%' }]}>
                        <View style={styles.modalHeader}>
                          <Text style={styles.modalTitle}>Select Tag</Text>
                          <TouchableOpacity onPress={() => setIsFilterTagPickerVisible(false)}>
                            <Ionicons name="close" size={24} color="#64748B" />
                          </TouchableOpacity>
                        </View>
                        <FlatList
                          data={['all_tags_option', ...tags]}
                          keyExtractor={(item, index) => `tag-${item}-${index}`}
                          renderItem={({ item }) => (
                            <TouchableOpacity 
                              style={styles.categoryItem} 
                              onPress={() => {
                                setFilters({ ...filters, tags: item === 'all_tags_option' ? '' : item });
                                setIsFilterTagPickerVisible(false);
                              }}
                            >
                              <Text style={[styles.categoryItemText, (filters.tags === item || (item === 'all_tags_option' && !filters.tags)) && { color: '#3B82F6', fontWeight: '700' }]}>
                                {item === 'all_tags_option' ? 'All Tags' : item}
                              </Text>
                              {(filters.tags === item || (item === 'all_tags_option' && !filters.tags)) && <Ionicons name="checkmark" size={20} color="#3B82F6" />}
                            </TouchableOpacity>
                          )}
                        />
                      </View>
                    </View>
                  </Modal>
                )}

                <View style={[styles.modalFooter, { marginTop: 40 }]}>
                  <TouchableOpacity 
                    style={styles.cancelBtn} 
                    onPress={() => {
                      setFilters({ category: '', tags: '', startDate: null, endDate: null, type: '' });
                      if (page === 1) {
                        fetchTransactions(true);
                      } else {
                        setPage(1);
                      }
                      setIsFilterModalVisible(false);
                    }}
                  >
                    <Text style={styles.cancelBtnText}>Reset</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.saveBtn} onPress={() => setIsFilterModalVisible(false)}>
                    <Text style={styles.saveBtnText}>Apply Filters</Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  searchSection: { flexDirection: 'row', padding: 16, alignItems: 'center', gap: 8 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 12, height: 48 },
  searchInput: { flex: 1, marginLeft: 8, fontSize: 16, color: '#1E293B' },
  limitSelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', paddingHorizontal: 12, height: 48, borderRadius: 12, gap: 4 },
  limitText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  filterBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#3B82F6' },
  limitDropdown: { position: 'absolute', top: 110, right: 70, width: 100, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 8, elevation: 10, zIndex: 1000, borderWidth: 1, borderColor: '#F1F5F9' },
  limitOption: { padding: 12, borderRadius: 8 },
  limitOptionText: { fontSize: 14, color: '#64748B' },
  limitOptionTextActive: { color: '#3B82F6', fontWeight: '600' },
  listContent: { padding: 16 },
  transactionCard: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, elevation: 2, borderWidth: 1, borderColor: '#F1F5F9' },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  typeIconContainer: { width: 44, height: 44, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginRight: 12 },
  cardTitleSection: { flex: 1 },
  transactionTitle: { fontSize: 16, fontWeight: '700', color: '#1E293B' },
  transactionDate: { fontSize: 12, color: '#64748B', marginTop: 2 },
  amountSection: { alignItems: 'flex-end' },
  amountText: { fontSize: 18, fontWeight: '800' },
  paymentModeText: { fontSize: 11, color: '#94A3B8', marginTop: 2 },
  noteSection: { marginTop: 12, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 8 },
  noteText: { fontSize: 13, color: '#64748B', fontStyle: 'italic' },
  tagsDisplay: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  displayTag: { backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  displayTagText: { fontSize: 11, color: '#3B82F6', fontWeight: '600' },
  cardActions: { flexDirection: 'row', marginTop: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingTop: 12, gap: 16 },
  cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  cardActionText: { fontSize: 14, fontWeight: '600', color: '#3B82F6' },
  pagination: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', paddingVertical: 20, gap: 20 },
  pageBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EFF6FF', justifyContent: 'center', alignItems: 'center' },
  pageBtnDisabled: { backgroundColor: '#F1F5F9' },
  pageInfo: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  fab: { position: 'absolute', bottom: 30, right: 20, width: 60, height: 60, borderRadius: 30, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center', elevation: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 32, borderTopRightRadius: 32, height: '90%', padding: 24 },
  filterModalContent: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, margin: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
  modalTitle: { fontSize: 22, fontWeight: '800', color: '#1E293B' },
  modalBody: { paddingBottom: 100 },
  label: { fontSize: 14, fontWeight: '600', color: '#64748B', marginBottom: 8, marginTop: 16 },
  input: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16, height: 54, fontSize: 16, color: '#1E293B', borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  textArea: { height: 80, textAlignVertical: 'top', paddingTop: 16 },
  inputIcon: { position: 'absolute', right: 16 },
  typeSelector: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  typeOption: { flex: 1, height: 44, borderRadius: 10, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  typeOptionActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
  typeOptionText: { fontSize: 14, fontWeight: '600', color: '#64748B' },
  typeOptionTextActive: { color: '#FFFFFF' },
  modeScroll: { flexDirection: 'row', marginTop: 4 },
  modePill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  modePillActive: { backgroundColor: '#EFF6FF', borderColor: '#3B82F6' },
  modePillText: { fontSize: 12, color: '#64748B', fontWeight: '500' },
  modePillTextActive: { color: '#3B82F6', fontWeight: '600' },
  row: { flexDirection: 'row', marginTop: 8 },
  tagInputContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addTagBtn: { width: 54, height: 54, borderRadius: 12, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  tagsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  tagPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  tagText: { fontSize: 14, color: '#1E293B' },
  modalFooter: { flexDirection: 'row', gap: 12, paddingVertical: 16, borderTopWidth: 1, borderTopColor: '#F1F5F9', backgroundColor: '#FFFFFF' },
  cancelBtn: { flex: 1, height: 54, borderRadius: 12, backgroundColor: '#F1F5F9', justifyContent: 'center', alignItems: 'center' },
  cancelBtnText: { fontSize: 16, fontWeight: '600', color: '#64748B' },
  saveBtn: { flex: 1, height: 54, borderRadius: 12, backgroundColor: '#3B82F6', justifyContent: 'center', alignItems: 'center' },
  saveBtnText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyTitle: { fontSize: 20, fontWeight: '700', color: '#1E293B', marginTop: 16 },
  emptySubtitle: { fontSize: 16, color: '#64748B', textAlign: 'center', marginTop: 8 },
  
  // New Styles
  dropdownTrigger: {
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 16,
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginTop: 8,
  },
  dropdownText: { fontSize: 16, color: '#1E293B' },
  categoryPickerContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 24,
    margin: 20,
    width: width - 40,
    maxHeight: '80%',
  },
  modalSearchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    marginBottom: 16,
  },
  modalSearchInput: { flex: 1, marginLeft: 8, fontSize: 14, color: '#1E293B' },
  categoryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  categoryItemActive: { backgroundColor: '#EFF6FF', borderRadius: 8, paddingHorizontal: 12 },
  categoryItemText: { fontSize: 15, color: '#475569' },
  categoryItemTextActive: { color: '#3B82F6', fontWeight: '600' },
  emptySearchText: { textAlign: 'center', color: '#94A3B8', marginTop: 20, fontSize: 14 },
  categoryListContainer: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    marginTop: 10,
  },
  closePickerText: {
    color: '#3B82F6',
    fontWeight: '700',
    marginLeft: 8,
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
  // New Summary Styles
  summaryContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    backgroundColor: '#F8FAFC',
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#FEE2E2',
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  summaryIconBox: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1E293B',
  },
  countBadge: {
    marginLeft: 'auto',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  countText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#64748B',
  },
});

export default TransactionsScreen;
