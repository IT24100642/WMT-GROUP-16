import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import api, { setAuthToken } from '../api/axios';
import { useStaffAuth } from '../context/StaffAuthContext';

export default function ReceptionistDashboardScreen() {
  const { profile, logout, token: staffToken } = useStaffAuth();
  const [loading, setLoading] = useState(true);
  const [bookings, setBookings] = useState([]);
  const [lastLoadedAt, setLastLoadedAt] = useState(null);
  const [busyBookingId, setBusyBookingId] = useState(null);

  const roleName = String(profile?.roleName || '').toLowerCase();
  const isReceptionist = roleName === 'receptionist';

  const loadBookings = useCallback(async () => {
    try {
      if (staffToken) setAuthToken('staff', staffToken);
      const res = await api.get('/staff-portal/bookings');
      const payload = res?.data?.data ?? res?.data;
      setBookings(Array.isArray(payload) ? payload : []);
      setLastLoadedAt(new Date());
    } catch (error) {
      if (error?.response?.status === 401) {
        Alert.alert('Session expired', 'Please sign in again.');
        return;
      }
      Alert.alert('Error', error?.response?.data?.error || 'Failed to load reservations');
    } finally {
      setLoading(false);
    }
  }, [staffToken]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const confirmOnWeb = (message) => {
    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      return window.confirm(message);
    }
    return false;
  };

  const isCancellationPending = (booking) =>
    String(booking?.status || '').toLowerCase() === 'cancellationrequested';

  const rejectCancellationRequest = useCallback(
    async (booking) => {
      const bookingId = String(booking?._id || '').trim();
      if (!bookingId) return;
      const runReject = async () => {
        try {
          setBusyBookingId(bookingId);
          if (staffToken) setAuthToken('staff', staffToken);
          const res = await api.post(`/staff-portal/bookings/${bookingId}/cancellation-request/reject`, {
            rejectionNote: 'Cancelled by receptionist',
          });
          const updated = res?.data?.data ?? res?.data;
          if (updated?._id) {
            setBookings((prev) => prev.map((b) => (String(b._id) === String(updated._id) ? updated : b)));
          } else {
            await loadBookings();
          }
          Alert.alert('Updated', 'Cancellation request was rejected.');
        } catch (error) {
          if (error?.response?.status === 401) {
            Alert.alert('Session expired', 'Please sign in again.');
            return;
          }
          Alert.alert('Error', error?.response?.data?.error || 'Failed to reject cancellation request');
        } finally {
          setBusyBookingId(null);
        }
      };

      if (Platform.OS === 'web') {
        const ok = confirmOnWeb('Reject this cancellation request and keep booking active?');
        if (ok) await runReject();
        return;
      }

      Alert.alert('Cancel this cancellation request?', 'This will keep the booking active.', [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, reject request', style: 'destructive', onPress: runReject },
      ]);
    },
    [loadBookings, staffToken]
  );

  const approveCancellationRequest = useCallback(
    async (booking) => {
      const bookingId = String(booking?._id || '').trim();
      if (!bookingId) return;
      const runApprove = async () => {
        try {
          setBusyBookingId(bookingId);
          if (staffToken) setAuthToken('staff', staffToken);
          const res = await api.post(`/staff-portal/bookings/${bookingId}/cancellation-request/approve`);
          const updated = res?.data?.data ?? res?.data;
          if (updated?._id) {
            setBookings((prev) => prev.map((b) => (String(b._id) === String(updated._id) ? updated : b)));
          } else {
            await loadBookings();
          }
          Alert.alert('Updated', 'Cancellation request was approved and the booking was cancelled.');
        } catch (error) {
          if (error?.response?.status === 401) {
            Alert.alert('Session expired', 'Please sign in again.');
            return;
          }
          Alert.alert('Error', error?.response?.data?.error || 'Failed to approve cancellation request');
        } finally {
          setBusyBookingId(null);
        }
      };

      if (Platform.OS === 'web') {
        const ok = confirmOnWeb('Approve this cancellation request? This cancels the booking.');
        if (ok) await runApprove();
        return;
      }

      Alert.alert(
        'Approve cancellation?',
        'This will cancel the booking and apply refund rules.',
        [
          { text: 'No', style: 'cancel' },
          { text: 'Yes, approve', style: 'destructive', onPress: runApprove },
        ]
      );
    },
    [loadBookings, staffToken]
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#c9a96e" />
      </View>
    );
  }

  if (!isReceptionist) {
    return (
      <View style={styles.center}>
        <Text style={styles.title}>Access denied</Text>
        <Text style={styles.subtle}>This dashboard is only for Receptionist role.</Text>
        <TouchableOpacity style={styles.btn} onPress={logout}>
          <Text style={styles.btnText}>Sign Out</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Receptionist Dashboard</Text>
      <Text style={styles.subtle}>All reservations are listed here.</Text>
      <View style={styles.topRow}>
        <Text style={styles.countText}>Total reservations loaded: {bookings.length}</Text>
        <TouchableOpacity style={styles.refreshBtn} onPress={loadBookings}>
          <Text style={styles.refreshBtnText}>Refresh</Text>
        </TouchableOpacity>
      </View>
      {!!lastLoadedAt && (
        <Text style={styles.lastLoadedText}>Last updated: {lastLoadedAt.toLocaleString()}</Text>
      )}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All Bookings</Text>
        {bookings.length === 0 ? (
          <Text style={styles.itemSub}>No reservations found.</Text>
        ) : (
          bookings.map((b) => (
            <View key={b._id} style={styles.item}>
              <View style={styles.itemHeader}>
                <Text style={styles.itemTitle}>Booking #{String(b._id)}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    String(b.status || '').toLowerCase() === 'cancelled'
                      ? styles.statusCancelled
                      : isCancellationPending(b)
                        ? styles.statusCancelPending
                        : styles.statusNormal,
                  ]}
                >
                  <Text style={styles.statusBadgeText}>
                    {String(b.status || '').toLowerCase() === 'cancelled'
                      ? 'CANCELLED'
                      : isCancellationPending(b)
                        ? 'CANCELLATION REQUESTED'
                        : String(b.status || 'pending').toUpperCase()}
                  </Text>
                </View>
              </View>
              <Text style={styles.itemSub}>
                Guest: {b.customerId?.name || 'Guest'} | {b.customerId?._id || '-'}
              </Text>
              <Text style={styles.itemSub}>
                Stay: {b.checkInDate ? new Date(b.checkInDate).toLocaleDateString() : '-'} to {b.checkOutDate ? new Date(b.checkOutDate).toLocaleDateString() : '-'}
              </Text>
              <Text style={styles.itemSub}>
                Room: {b.roomId?.roomNumber ? `Room ${b.roomId.roomNumber}` : b.offerId?.title ? `Offer: ${b.offerId.title}` : '-'}
              </Text>
              {isCancellationPending(b) && (
                <>
                  <Text style={styles.cancelInfo}>
                    Guest has requested cancellation.
                  </Text>
                  <View style={styles.pendingActionsRow}>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        styles.approveBtn,
                        busyBookingId === String(b._id) && styles.actionBtnDisabled,
                      ]}
                      disabled={busyBookingId === String(b._id)}
                      onPress={() => approveCancellationRequest(b)}
                    >
                      <Text style={styles.approveBtnText}>
                        {busyBookingId === String(b._id) ? 'Updating...' : 'Approve'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        styles.rejectBtn,
                        busyBookingId === String(b._id) && styles.actionBtnDisabled,
                      ]}
                      disabled={busyBookingId === String(b._id)}
                      onPress={() => rejectCancellationRequest(b)}
                    >
                      <Text style={styles.rejectBtnText}>
                        {busyBookingId === String(b._id) ? 'Updating...' : 'Cancel Request'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </>
              )}
              {String(b.status || '').toLowerCase() === 'cancelled' && (
                <Text style={styles.cancelInfo}>
                  Cancelled at: {b.cancelledAt ? new Date(b.cancelledAt).toLocaleString() : 'N/A'}
                </Text>
              )}
              <Text style={styles.itemSub}>Total: LKR {Math.round(Number(b.totalPrice) || 0)}</Text>
            </View>
          ))
        )}
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
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  countText: { color: '#3d2b1f', fontWeight: '700' },
  refreshBtn: { backgroundColor: '#3d2b1f', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 7 },
  refreshBtnText: { color: '#c9a96e', fontWeight: '700' },
  lastLoadedText: { color: '#6b6b6b', marginBottom: 10, fontSize: 12 },
  card: { backgroundColor: '#fff', borderRadius: 10, padding: 12, marginBottom: 12 },
  cardTitle: { fontSize: 18, fontWeight: '700', color: '#3d2b1f', marginBottom: 8 },
  item: { borderWidth: 1, borderColor: '#eee', borderRadius: 8, padding: 8, marginBottom: 8 },
  itemHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  itemTitle: { color: '#2a2a2a', fontWeight: '700' },
  itemSub: { color: '#6b6b6b', marginTop: 2 },
  statusBadge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 },
  statusNormal: { backgroundColor: '#e8e0d5' },
  statusCancelPending: { backgroundColor: '#fef3c7' },
  statusCancelled: { backgroundColor: '#fee2e2' },
  statusBadgeText: { fontSize: 11, fontWeight: '800', color: '#3d2b1f' },
  cancelInfo: { color: '#9a3412', marginTop: 4, fontWeight: '600' },
  pendingActionsRow: { flexDirection: 'row', marginTop: 8, gap: 8, flexWrap: 'wrap' },
  actionBtn: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8 },
  actionBtnDisabled: { opacity: 0.65 },
  approveBtn: { backgroundColor: '#166534' },
  approveBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  rejectBtn: { backgroundColor: '#7f1d1d' },
  rejectBtnText: { color: '#fff', fontWeight: '700', fontSize: 12 },
  btn: { backgroundColor: '#3d2b1f', borderRadius: 8, padding: 10, alignItems: 'center' },
  btnText: { color: '#c9a96e', fontWeight: '700' },
});

