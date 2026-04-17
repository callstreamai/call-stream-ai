-- ============================================================
-- VERTICAL TEMPLATE SEED DATA
-- ============================================================

-- Hotels & Resorts
INSERT INTO public.vertical_templates (vertical, name, description) VALUES
('hotels_resorts', 'Hotels & Resorts', 'Full-service hotel and resort operations template');

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'hotels_resorts')
INSERT INTO public.vertical_template_departments (template_id, name, code, description, display_order, is_default) VALUES
(( SELECT id FROM tmpl), 'Front Desk', 'front_desk', 'Guest check-in, check-out, general inquiries', 1, TRUE),
((SELECT id FROM tmpl), 'Concierge', 'concierge', 'Guest services, recommendations, bookings', 2, FALSE),
((SELECT id FROM tmpl), 'Housekeeping', 'housekeeping', 'Room cleaning, maintenance requests', 3, FALSE),
((SELECT id FROM tmpl), 'Room Service', 'room_service', 'In-room dining orders', 4, FALSE),
((SELECT id FROM tmpl), 'Dining', 'dining', 'Restaurant reservations and information', 5, FALSE),
((SELECT id FROM tmpl), 'Spa & Wellness', 'spa', 'Spa appointments, wellness services', 6, FALSE),
((SELECT id FROM tmpl), 'Valet & Parking', 'valet', 'Valet service and parking information', 7, FALSE),
((SELECT id FROM tmpl), 'Pool & Recreation', 'pool', 'Pool hours, recreation activities', 8, FALSE),
((SELECT id FROM tmpl), 'Events & Meetings', 'events', 'Event spaces, meeting rooms, catering', 9, FALSE),
((SELECT id FROM tmpl), 'Billing & Accounts', 'billing', 'Folio inquiries, charges, payments', 10, FALSE),
((SELECT id FROM tmpl), 'Lost & Found', 'lost_found', 'Lost item inquiries and claims', 11, FALSE),
((SELECT id FROM tmpl), 'Security', 'security', 'Security concerns, safe access', 12, FALSE);

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'hotels_resorts')
INSERT INTO public.vertical_template_intents (template_id, department_code, intent_key, label, description, priority) VALUES
((SELECT id FROM tmpl), 'front_desk', 'check_in', 'Check-In', 'Guest wants to check in', 10),
((SELECT id FROM tmpl), 'front_desk', 'check_out', 'Check-Out', 'Guest wants to check out', 10),
((SELECT id FROM tmpl), 'front_desk', 'reservation_inquiry', 'Reservation Inquiry', 'Questions about existing reservation', 9),
((SELECT id FROM tmpl), 'front_desk', 'make_reservation', 'Make Reservation', 'Guest wants to book a room', 9),
((SELECT id FROM tmpl), 'front_desk', 'room_change', 'Room Change Request', 'Guest wants to change rooms', 7),
((SELECT id FROM tmpl), 'concierge', 'restaurant_recommendation', 'Restaurant Recommendation', 'Guest needs dining recommendations', 8),
((SELECT id FROM tmpl), 'concierge', 'activity_booking', 'Activity Booking', 'Book tours, activities, transportation', 7),
((SELECT id FROM tmpl), 'concierge', 'local_info', 'Local Information', 'Area attractions, directions', 6),
((SELECT id FROM tmpl), 'housekeeping', 'room_cleaning', 'Room Cleaning', 'Request room cleaning', 8),
((SELECT id FROM tmpl), 'housekeeping', 'extra_amenities', 'Extra Amenities', 'Request towels, pillows, etc.', 7),
((SELECT id FROM tmpl), 'housekeeping', 'maintenance_request', 'Maintenance Request', 'Report something broken', 9),
((SELECT id FROM tmpl), 'room_service', 'place_order', 'Place Order', 'Order food to room', 10),
((SELECT id FROM tmpl), 'room_service', 'menu_inquiry', 'Menu Inquiry', 'Questions about menu', 6),
((SELECT id FROM tmpl), 'dining', 'dining_reservation', 'Dining Reservation', 'Book restaurant table', 10),
((SELECT id FROM tmpl), 'dining', 'dining_hours', 'Dining Hours', 'Restaurant hours inquiry', 6),
((SELECT id FROM tmpl), 'dining', 'dietary_info', 'Dietary Information', 'Allergy/dietary questions', 7),
((SELECT id FROM tmpl), 'spa', 'spa_appointment', 'Spa Appointment', 'Book spa treatment', 9),
((SELECT id FROM tmpl), 'spa', 'spa_info', 'Spa Information', 'Spa services and pricing', 5),
((SELECT id FROM tmpl), 'valet', 'car_retrieval', 'Car Retrieval', 'Request car from valet', 10),
((SELECT id FROM tmpl), 'valet', 'parking_info', 'Parking Information', 'Parking rates and locations', 5),
((SELECT id FROM tmpl), 'billing', 'folio_inquiry', 'Folio Inquiry', 'Check charges on bill', 8),
((SELECT id FROM tmpl), 'billing', 'dispute_charge', 'Dispute Charge', 'Challenge a charge', 9),
((SELECT id FROM tmpl), 'events', 'event_inquiry', 'Event Inquiry', 'Ask about event spaces', 7),
((SELECT id FROM tmpl), 'events', 'event_booking', 'Event Booking', 'Book event space', 8),
((SELECT id FROM tmpl), 'lost_found', 'lost_item', 'Lost Item', 'Report or inquire about lost item', 7),
((SELECT id FROM tmpl), 'security', 'security_concern', 'Security Concern', 'Report security issue', 10);

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'hotels_resorts')
INSERT INTO public.vertical_template_routing_rules (template_id, department_code, intent_key, condition_type, action_type, action_label, action_value, priority, is_fallback) VALUES
((SELECT id FROM tmpl), 'front_desk', 'make_reservation', 'intent_match', 'send_sms_link', 'Booking link', 'https://booking.example.com', 10, FALSE),
((SELECT id FROM tmpl), 'front_desk', 'check_in', 'intent_match', 'transfer', 'Front Desk', '+15551234001', 10, FALSE),
((SELECT id FROM tmpl), 'dining', 'dining_reservation', 'intent_match', 'send_sms_link', 'Reservation link', 'https://dining.example.com', 10, FALSE),
((SELECT id FROM tmpl), 'dining', NULL, 'closed', 'info_response', 'Dining closed message', 'Our restaurants are currently closed. Please check back during operating hours.', 5, FALSE),
((SELECT id FROM tmpl), 'spa', 'spa_appointment', 'intent_match', 'send_sms_link', 'Spa booking link', 'https://spa.example.com', 10, FALSE),
((SELECT id FROM tmpl), 'housekeeping', 'maintenance_request', 'intent_match', 'transfer', 'Maintenance', '+15551234003', 9, FALSE),
((SELECT id FROM tmpl), 'valet', 'car_retrieval', 'intent_match', 'transfer', 'Valet Desk', '+15551234007', 10, FALSE),
((SELECT id FROM tmpl), 'billing', 'dispute_charge', 'intent_match', 'escalate', 'Billing Manager', 'billing_manager', 10, FALSE),
((SELECT id FROM tmpl), NULL, NULL, 'fallback', 'transfer', 'General Operator', 'operator_transfer', 0, TRUE);

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'hotels_resorts')
INSERT INTO public.vertical_template_kb_items (template_id, category, question, answer, department_code, intent_key, tags, priority) VALUES
((SELECT id FROM tmpl), 'Check-In/Out', 'What time is check-in?', 'Check-in time is 3:00 PM. Early check-in may be available upon request.', 'front_desk', 'check_in', ARRAY['check-in', 'time', 'arrival'], 10),
((SELECT id FROM tmpl), 'Check-In/Out', 'What time is check-out?', 'Check-out time is 11:00 AM. Late check-out may be available upon request for an additional fee.', 'front_desk', 'check_out', ARRAY['check-out', 'time', 'departure'], 10),
((SELECT id FROM tmpl), 'Amenities', 'Is there a pool?', 'Yes, our pool is open daily. Hours vary by season.', 'pool', NULL, ARRAY['pool', 'swimming', 'amenities'], 7),
((SELECT id FROM tmpl), 'Amenities', 'Do you have a gym?', 'Yes, our fitness center is open 24/7 for registered guests.', 'spa', NULL, ARRAY['gym', 'fitness', 'workout'], 7),
((SELECT id FROM tmpl), 'Parking', 'How much is parking?', 'Valet parking is $45/night. Self-parking is $30/night.', 'valet', 'parking_info', ARRAY['parking', 'valet', 'cost'], 8),
((SELECT id FROM tmpl), 'Dining', 'What restaurants do you have?', 'We offer multiple dining venues. Please ask about specific cuisine preferences.', 'dining', NULL, ARRAY['restaurant', 'food', 'dining'], 8),
((SELECT id FROM tmpl), 'WiFi', 'Is WiFi free?', 'Complimentary WiFi is available throughout the property for all guests.', 'front_desk', NULL, ARRAY['wifi', 'internet', 'free'], 9),
((SELECT id FROM tmpl), 'Pets', 'Are pets allowed?', 'We welcome pets in select rooms. A pet fee may apply. Please inquire about our pet policy.', 'front_desk', NULL, ARRAY['pets', 'dogs', 'animals'], 7);

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'hotels_resorts')
INSERT INTO public.vertical_template_hours (template_id, department_code, day_of_week, open_time, close_time, is_closed) VALUES
-- Front Desk 24/7
((SELECT id FROM tmpl), 'front_desk', 0, '00:00', '23:59', FALSE),
((SELECT id FROM tmpl), 'front_desk', 1, '00:00', '23:59', FALSE),
((SELECT id FROM tmpl), 'front_desk', 2, '00:00', '23:59', FALSE),
((SELECT id FROM tmpl), 'front_desk', 3, '00:00', '23:59', FALSE),
((SELECT id FROM tmpl), 'front_desk', 4, '00:00', '23:59', FALSE),
((SELECT id FROM tmpl), 'front_desk', 5, '00:00', '23:59', FALSE),
((SELECT id FROM tmpl), 'front_desk', 6, '00:00', '23:59', FALSE),
-- Dining (typical hours)
((SELECT id FROM tmpl), 'dining', 0, '07:00', '22:00', FALSE),
((SELECT id FROM tmpl), 'dining', 1, '07:00', '22:00', FALSE),
((SELECT id FROM tmpl), 'dining', 2, '07:00', '22:00', FALSE),
((SELECT id FROM tmpl), 'dining', 3, '07:00', '22:00', FALSE),
((SELECT id FROM tmpl), 'dining', 4, '07:00', '23:00', FALSE),
((SELECT id FROM tmpl), 'dining', 5, '07:00', '23:00', FALSE),
((SELECT id FROM tmpl), 'dining', 6, '07:00', '22:00', FALSE),
-- Spa
((SELECT id FROM tmpl), 'spa', 0, '09:00', '19:00', FALSE),
((SELECT id FROM tmpl), 'spa', 1, '09:00', '20:00', FALSE),
((SELECT id FROM tmpl), 'spa', 2, '09:00', '20:00', FALSE),
((SELECT id FROM tmpl), 'spa', 3, '09:00', '20:00', FALSE),
((SELECT id FROM tmpl), 'spa', 4, '09:00', '21:00', FALSE),
((SELECT id FROM tmpl), 'spa', 5, '09:00', '21:00', FALSE),
((SELECT id FROM tmpl), 'spa', 6, '09:00', '19:00', FALSE);

-- ============================================================
-- Travel Vertical
-- ============================================================
INSERT INTO public.vertical_templates (vertical, name, description) VALUES
('travel', 'Travel', 'Travel agency and tour operator operations');

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'travel')
INSERT INTO public.vertical_template_departments (template_id, name, code, description, display_order, is_default) VALUES
((SELECT id FROM tmpl), 'Reservations', 'reservations', 'Flight, hotel, package bookings', 1, TRUE),
((SELECT id FROM tmpl), 'Customer Support', 'support', 'General travel support', 2, FALSE),
((SELECT id FROM tmpl), 'Tours & Activities', 'tours', 'Tour bookings and activity planning', 3, FALSE),
((SELECT id FROM tmpl), 'Transportation', 'transport', 'Airport transfers, car rentals', 4, FALSE),
((SELECT id FROM tmpl), 'Group Travel', 'groups', 'Group bookings and coordination', 5, FALSE),
((SELECT id FROM tmpl), 'Travel Insurance', 'insurance', 'Insurance claims and coverage', 6, FALSE),
((SELECT id FROM tmpl), 'Loyalty & Rewards', 'loyalty', 'Points, rewards, membership', 7, FALSE),
((SELECT id FROM tmpl), 'Billing', 'billing', 'Payments, refunds, invoices', 8, FALSE);

-- Food & Beverage
INSERT INTO public.vertical_templates (vertical, name, description) VALUES
('food_beverage', 'Food & Beverage', 'Restaurant, bar, and food service operations');

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'food_beverage')
INSERT INTO public.vertical_template_departments (template_id, name, code, description, display_order, is_default) VALUES
((SELECT id FROM tmpl), 'Host / Reservations', 'host', 'Table reservations and seating', 1, TRUE),
((SELECT id FROM tmpl), 'Takeout & Delivery', 'takeout', 'Takeout orders and delivery', 2, FALSE),
((SELECT id FROM tmpl), 'Catering', 'catering', 'Catering services and events', 3, FALSE),
((SELECT id FROM tmpl), 'Bar & Lounge', 'bar', 'Bar services and drink menu', 4, FALSE),
((SELECT id FROM tmpl), 'Private Events', 'private_events', 'Private dining and event bookings', 5, FALSE),
((SELECT id FROM tmpl), 'General Manager', 'gm', 'Escalations and feedback', 6, FALSE);

-- Entertainment
INSERT INTO public.vertical_templates (vertical, name, description) VALUES
('entertainment', 'Entertainment', 'Venues, shows, attractions operations');

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'entertainment')
INSERT INTO public.vertical_template_departments (template_id, name, code, description, display_order, is_default) VALUES
((SELECT id FROM tmpl), 'Box Office', 'box_office', 'Ticket sales and availability', 1, TRUE),
((SELECT id FROM tmpl), 'Guest Services', 'guest_services', 'General visitor assistance', 2, FALSE),
((SELECT id FROM tmpl), 'VIP & Premium', 'vip', 'VIP packages and premium experiences', 3, FALSE),
((SELECT id FROM tmpl), 'Group Sales', 'group_sales', 'Group tickets and packages', 4, FALSE),
((SELECT id FROM tmpl), 'Events', 'events', 'Special events and shows', 5, FALSE),
((SELECT id FROM tmpl), 'Lost & Found', 'lost_found', 'Lost item inquiries', 6, FALSE),
((SELECT id FROM tmpl), 'Accessibility', 'accessibility', 'ADA accommodations and assistance', 7, FALSE);

-- Recreation & Wellness
INSERT INTO public.vertical_templates (vertical, name, description) VALUES
('recreation_wellness', 'Recreation & Wellness', 'Gyms, spas, recreation centers');

WITH tmpl AS (SELECT id FROM public.vertical_templates WHERE vertical = 'recreation_wellness')
INSERT INTO public.vertical_template_departments (template_id, name, code, description, display_order, is_default) VALUES
((SELECT id FROM tmpl), 'Front Desk', 'front_desk', 'Check-in, membership inquiries', 1, TRUE),
((SELECT id FROM tmpl), 'Membership', 'membership', 'Membership sales and management', 2, FALSE),
((SELECT id FROM tmpl), 'Class Scheduling', 'classes', 'Fitness class bookings', 3, FALSE),
((SELECT id FROM tmpl), 'Personal Training', 'training', 'PT sessions and consultations', 4, FALSE),
((SELECT id FROM tmpl), 'Spa Services', 'spa', 'Spa treatments and wellness', 5, FALSE),
((SELECT id FROM tmpl), 'Aquatics', 'aquatics', 'Pool, swim lessons, water activities', 6, FALSE),
((SELECT id FROM tmpl), 'Kids Programs', 'kids', 'Children activities and childcare', 7, FALSE),
((SELECT id FROM tmpl), 'Pro Shop', 'pro_shop', 'Equipment and merchandise', 8, FALSE);
