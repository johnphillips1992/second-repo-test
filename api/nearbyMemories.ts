import { VercelRequest, VercelResponse } from '@vercel/node';
import { firestore } from '../utils/firebase-admin';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Extract query parameters
    const { userId, latitude, longitude, radius = 5 } = req.query;

    // Validate required parameters
    if (!userId || !latitude || !longitude) {
      return res.status(400).json({ 
        error: 'Missing required parameters: userId, latitude, longitude' 
      });
    }

    // Convert parameters to appropriate types
    const lat = parseFloat(latitude as string);
    const lng = parseFloat(longitude as string);
    const radiusKm = parseFloat(radius as string);

    if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
      return res.status(400).json({ 
        error: 'Invalid coordinates or radius' 
      });
    }

    // Get all memories for this user
    // In a production app, you'd use geohashing for better performance
    const memorySnapshot = await firestore
      .collection('memories')
      .where('userId', '==', userId)
      .get();

    const memories: any[] = [];
    
    // Filter memories by distance
    memorySnapshot.forEach(doc => {
      const data = doc.data();
      const memLat = data.location.latitude;
      const memLng = data.location.longitude;
      
      // Calculate distance using Haversine formula
      const distance = calculateDistance(lat, lng, memLat, memLng);
      
      // Only include memories within the radius
      if (distance <= radiusKm) {
        memories.push({
          id: doc.id,
          ...data,
          distance // Include the calculated distance
        });
      }
    });
    
    // Sort memories by distance
    memories.sort((a, b) => a.distance - b.distance);

    return res.status(200).json({ memories });
  } catch (error) {
    console.error('Error retrieving nearby memories:', error);
    return res.status(500).json({ error: 'Failed to retrieve memories' });
  }
}

// Calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const distance = R * c; // Distance in km
  return distance;
}

function deg2rad(deg: number): number {
  return deg * (Math.PI/180);
}