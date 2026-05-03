import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api, { setAuthToken } from '../api/axios';
import { useStaffAuth } from '../context/StaffAuthContext';

const ORDER_STATUS_UI = ['received', 'preparing', 'completed', 'cancelled'];

export default function KitchenManagerDashboardScreen() {
  const { profile, logout, token: staffToken } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [orders, setOrders] = useState([]);

  const [newItem, setNewItem] = useState({ name: '', description: '', price: '', sortOrder: '0', categoryId: '' });
  const [editingItemId, setEditingItemId] = useState(null);
  const [editDraft, setEditDraft] = useState({
    name: '',
    description: '',
    price: '',
    sortOrder: '',
    categoryId: '',
  });

  const roleName = String(profile?.roleName || '').toLowerCase();
  const isKitchen = roleName === 'kitchen manager' || roleName === 'kitchen_manager';

  const loadAll = useCallback(async () => {
    try {
      if (staffToken) setAuthToken('staff', staffToken);
      const [i, o] = await Promise.all([
        api.get('/staff-portal/kitchen/food-items'),
        api.get('/staff-portal/kitchen/food-orders'),
      ]);
      setItems(Array.isArray(i.data) ? i.data : []);
      setOrders(Array.isArray(o.data) ? o.data : []);
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load kitchen data');
    } finally {
      setLoading(false);
    }
  }, [staffToken]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useFocusEffect(
    useCallback(() => {
      if (staffToken) setAuthToken('staff', staffToken);
      loadAll();
    }, [staffToken, loadAll])
  );

  const createItem = async () => {
    try {
      await api.post('/staff-portal/kitchen/food-items', {
        name: newItem.name.trim(),
        description: newItem.description.trim(),
        price: Number(newItem.price) || 0,
        sortOrder: Number(newItem.sortOrder) || 0,
        categoryId: newItem.categoryId || undefined,
      });
      setNewItem({ name: '', description: '', price: '', sortOrder: '0', categoryId: '' });
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not create food item');
    }
  };

  const updateItem = async (id, patch) => {
    try {
      await api.patch(`/staff-portal/kitchen/food-items/${id}`, patch);
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update food item');
    }
  };

  const deleteItem = async (id) => {
    try {
      await api.delete(`/staff-portal/kitchen/food-items/${id}`);
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not delete food item');
    }
  };

  const beginEditItem = (it) => {
    const catId = it.category?._id ?? it.category;
    setEditingItemId(it._id);
    setEditDraft({
      name: it.name || '',
      description: it.description || '',
      price: String(Math.round(Number(it.price) || 0)),
      sortOrder: String(it.sortOrder ?? 0),
      categoryId: catId != null ? String(catId) : '',
    });
  };

  const saveEditItem = async (id) => {
    try {
      if (staffToken) setAuthToken('staff', staffToken);
      await api.patch(`/staff-portal/kitchen/food-items/${id}`, {
        name: editDraft.name.trim(),
        description: editDraft.description.trim(),
        price: Math.round(Number(editDraft.price)) || 0,
        sortOrder: Math.floor(Number(editDraft.sortOrder)) || 0,
        categoryId: editDraft.categoryId.trim(),
      });
      setEditingItemId(null);
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update food item');
    }
  };

  const patchOrderStatus = async (id, nextStatus) => {
    try {
      await api.patch(`/staff-portal/kitchen/food-orders/${id}`, { orderStatus: nextStatus });
      loadAll();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.error || 'Could not update order status');
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a96e" />
      </View>
    );
  }

  if (!isKitchen) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access denied</Text>
        <Text style={styles.subtle}>This dashboard is only for Kitchen Manager role.</Text>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Kitchen Manager Dashboard</Text>
      <Text style={styles.subtle}>Manage food menu and incoming orders.</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Create Food Item</Text>
        <TextInput style={styles.input} placeholder="Name" value={newItem.name} onChangeText={(v) => setNewItem((s) => ({ ...s, name: v }))} />
        <TextInput style={styles.input} placeholder="Description" value={newItem.description} onChangeText={(v) => setNewItem((s) => ({ ...s, description: v }))} />
        <TextInput style={styles.input} placeholder="Price (LKR)" keyboardType="numeric" value={newItem.price} onChangeText={(v) => setNewItem((s) => ({ ...s, price: v }))} />
        <TextInput style={styles.input} placeholder="Sort order" keyboardType="numeric" value={newItem.sortOrder} onChangeText={(v) => setNewItem((s) => ({ ...s, sortOrder: v }))} />
        <TextInput style={styles.input} placeholder="Category ID (optional)" value={newItem.categoryId} onChangeText={(v) => setNewItem((s) => ({ ...s, categoryId: v }))} />
        <TouchableOpacity style={styles.btn} onPress={createItem}><Text style={styles.btnText}>Add Food Item</Text></TouchableOpacity>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Menu Items</Text>
        {items.map((it) => (
          <View key={it._id} style={styles.item}>
            {editingItemId === it._id ? (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="Name"
                  value={editDraft.name}
                  onChangeText={(v) => setEditDraft((s) => ({ ...s, name: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Description"
                  value={editDraft.description}
                  onChangeText={(v) => setEditDraft((s) => ({ ...s, description: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Price (LKR)"
                  keyboardType="numeric"
                  value={editDraft.price}
                  onChangeText={(v) => setEditDraft((s) => ({ ...s, price: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Sort order"
                  keyboardType="numeric"
                  value={editDraft.sortOrder}
                  onChangeText={(v) => setEditDraft((s) => ({ ...s, sortOrder: v }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Category ID (optional)"
                  value={editDraft.categoryId}
                  onChangeText={(v) => setEditDraft((s) => ({ ...s, categoryId: v }))}
                />
                <View style={styles.row}>
                  <TouchableOpacity onPress={() => saveEditItem(it._id)}>
                    <Text style={styles.link}>Save</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setEditingItemId(null)}>
                    <Text style={styles.link}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <>
                <Text style={styles.itemTitle}>{it.name} · LKR {Math.round(Number(it.price) || 0)}</Text>
                <Text style={styles.itemSub}>{it.description || '-'} | {it.active ? 'In stock' : 'Out of stock'}</Text>
                <View style={styles.row}>
                  <TouchableOpacity onPress={() => updateItem(it._id, { active: !it.active })}><Text style={styles.link}>Toggle stock</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => updateItem(it._id, { price: Math.max(0, Math.round(Number(it.price) || 0) + 100) })}><Text style={styles.link}>+100 price</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => beginEditItem(it)}><Text style={styles.link}>Edit</Text></TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteItem(it._id)}><Text style={styles.delete}>Delete</Text></TouchableOpacity>
                </View>
              </>
            )}
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Incoming Orders</Text>
        {orders.map((o) => (
          <View key={o._id} style={styles.item}>
            <Text style={styles.itemTitle}>Order #{String(o._id)} · {o.customer?.email || 'guest'}</Text>
            <Text style={styles.itemSub}>Status: {o.orderStatus} | Payment: {o.paymentMethod} / {o.paymentStatus}</Text>
            <View style={styles.row}>
              {ORDER_STATUS_UI.map((st) => (
                <TouchableOpacity key={st} onPress={() => patchOrderStatus(o._id, st)}>
                  <Text style={styles.link}>{st}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f0e8' },
  content: { padding: 16, paddingBottom: 32 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f0e8', padding: 20 },
  title: { fontSize: 28, fontWeight: '800', color: '#3d2b1f', marginBottom: 6 },
  subtle: { color: '#6b6b6b', marginBottom: 10 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3d2b1f', marginBottom: 8 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  btn: { backgroundColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnText: { color: '#c9a96e', fontWeight: '700' },
  item: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8 },
  itemTitle: { color: '#2a2a2a', fontWeight: '700' },
  itemSub: { color: '#6b6b6b', marginTop: 2 },
  row: { flexDirection: 'row', gap: 10, marginTop: 6, flexWrap: 'wrap' },
  link: { color: '#1f6feb', fontWeight: '600' },
  delete: { color: '#b42318', fontWeight: '700' },
});
