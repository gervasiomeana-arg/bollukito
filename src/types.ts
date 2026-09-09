export interface ReservationOffer {
  bookingId: string;
  roomType: 'Doble' | 'Triple';
  guests: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  pricePerNight: number;
  totalPrice: number;
  currency: string;
  status: 'pending_payment' | 'paid';
  guestName?: string;
  guestDoc?: string;
  guestPhone?: string;
  paymentRef?: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  reservationOffer?: ReservationOffer;
  quickReplies?: string[];
}

export interface ConfirmedReservation {
  id: string;
  bookingId: string;
  guestName: string;
  guestDoc: string;
  guestPhone: string;
  roomType: 'Doble' | 'Triple';
  guests: number;
  checkIn: string;
  checkOut: string;
  nights: number;
  totalPrice: number;
  currency: string;
  paymentRef: string;
  paymentMethod: string;
  paidAt: string;
  loadedInHotelSystem: boolean;
  loadedAt?: string;
  receptionistNotified: boolean;
}

export interface HotelKnowledgeItem {
  id: string;
  topic: string;
  answer: string;
}

export interface HotelConfig {
  hotelName: string;
  mascotName: string;
  mascotRole: string;
  receptionistPhone: string;
  doubleRoomPrice: number;
  tripleRoomPrice: number;
  checkInTime: string;
  checkOutTime: string;
  breakfastHours: string;
  address: string;
  parkingAvailable: boolean;
  petFriendly: boolean;
  wifiName: string;
  knowledgeBase: HotelKnowledgeItem[];
}
