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

export interface AvailableOption {
  roomTypeId: string;
  roomTypeName: string;
  roomId: string;
  roomNumber: string;
  capacity: number;
  baseRate: number;
}

export interface PendingConfirmation {
  reservationId: string;
  reservationCode: string;
  roomTypeName: string;
  roomNumber: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalAmount?: number;
  reservationStatus: string;
  paymentStatus: string;
  actionTaken?: 'confirmed' | 'modified';
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'bot' | 'system';
  text: string;
  timestamp: string;
  reservationOffer?: ReservationOffer;
  availableOptions?: AvailableOption[];
  pendingConfirmation?: PendingConfirmation;
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
  breakfastInfo?: string;
  address: string;
  parkingAvailable: boolean;
  parkingInfo?: string;
  petFriendly: boolean;
  petPolicy?: string;
  cancellationPolicy?: string;
  depositPolicy?: string;
  services?: string;
  wifiName: string;
  knowledgeBase: HotelKnowledgeItem[];
}

export interface Conversation {
  id: string;
  hotelId: string;
  customerId?: string | null;
  phoneNumber: string;
  channel: string;
  status: 'BOT_ACTIVE' | 'WAITING_HUMAN' | 'HUMAN_ACTIVE' | 'BOT_RESUMED' | 'CLOSED';
  assignedUserId?: string | null;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export type MessageSenderType = 'CUSTOMER' | 'BOT' | 'HUMAN' | 'SYSTEM';

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderType: MessageSenderType;
  content: string;
  externalMessageId?: string | null;
  createdAt: string | Date;
}

export interface RoomTypeData {
  id: string;
  hotelId: string;
  name: string;
  description: string | null;
  capacity: number;
  baseRate: string | number;
  active: boolean | null;
  createdAt?: string;
  updatedAt?: string;
}

export type RoomStatus = 'AVAILABLE' | 'OCCUPIED' | 'BLOCKED' | 'MAINTENANCE';

export interface RoomData {
  id: string;
  hotelId: string;
  roomTypeId: string;
  number: string;
  status: RoomStatus;
  active: boolean | null;
  roomType?: RoomTypeData | null;
  createdAt?: string;
  updatedAt?: string;
}
