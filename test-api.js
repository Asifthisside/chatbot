// Simple test script to check API endpoints locally
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:5000/api';

async function testEndpoints() {
  console.log('Testing API endpoints...\n');
  
  // Test health endpoint
  try {
    console.log('1. Testing /api/health...');
    const health = await axios.get(`${API_URL}/health`);
    console.log('✅ Health check:', health.data);
  } catch (error) {
    console.log('❌ Health check failed:', error.message);
  }
  
  // Test chatbot test endpoint
  try {
    console.log('\n2. Testing /api/chatbots/test...');
    const test = await axios.get(`${API_URL}/chatbots/test`);
    console.log('✅ Chatbot test:', test.data);
  } catch (error) {
    console.log('❌ Chatbot test failed:', error.message);
  }
  
  // Test get chatbots
  try {
    console.log('\n3. Testing /api/chatbots...');
    const chatbots = await axios.get(`${API_URL}/chatbots`);
    console.log('✅ Get chatbots:', `Found ${chatbots.data.length} chatbots`);
  } catch (error) {
    console.log('❌ Get chatbots failed:', error.response?.data || error.message);
  }
  
  // Test stats endpoint
  try {
    console.log('\n4. Testing /api/messages/stats...');
    const stats = await axios.get(`${API_URL}/messages/stats`);
    console.log('✅ Get stats:', stats.data);
  } catch (error) {
    console.log('❌ Get stats failed:', error.response?.data || error.message);
  }
  
  console.log('\n✅ Testing complete!');
}

testEndpoints().catch(console.error);






