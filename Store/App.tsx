import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Image, FlatList, StyleSheet, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios from 'axios';

// Налаштування Axios для бекенду
const api = axios.create({
  baseURL: 'http://192.168.1.2:5259/api', // IP ноутбука
  headers: { 'Content-Type': 'multipart/form-data' },
  timeout: 10000, // Збільшуємо тайм-аут до 10 секунд
});

// Дебаг-записи
api.interceptors.request.use(
    request => {
      console.log('Request:', request.method, request.url, request.data);
      return request;
    },
    error => {
      console.error('Request error:', error.message);
      return Promise.reject(error);
    }
);

api.interceptors.response.use(
    response => {
      console.log('Response:', response.status, response.data);
      return response;
    },
    error => {
      console.error('Response error:', error.message);
      if (error.code === 'ECONNABORTED') {
        console.error('Timeout: Сервер не відповів протягом 10 секунд');
      }
      return Promise.reject(error);
    }
);

interface User {
  name: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string | null;
}

const App: React.FC = () => {
  const [page, setPage] = useState<'register' | 'login' | 'products'>('register');
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const checkToken = async () => {
      try {
        const storedToken = await AsyncStorage.getItem('jwt_token');
        if (storedToken) {
          setToken(storedToken);
          setPage('products');
        }
      } catch (error) {
        console.error('Помилка перевірки токена:', error);
      }
    };
    checkToken();
  }, []);

  useEffect(() => {
    if (token) {
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete api.defaults.headers.common['Authorization'];
    }
  }, [token]);

  const checkServer = async () => {
    try {
      console.log('Перевірка доступності сервера...');
      await api.get('/ping');
      console.log('Сервер доступний!');
      return true;
    } catch (error) {
      Alert.alert('Помилка мережі', 'Не вдалося підключитися до сервера. Перевір IP, порт або брандмауер.');
      return false;
    }
  };

  const RegisterPage: React.FC = () => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [photo, setPhoto] = useState<string | null>(null);

    const pickImage = async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Дозвіл відхилено', 'Дозвольте доступ до фото.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        base64: true,
        quality: 0.3, // Зменшуємо якість для зменшення розміру
      });
      if (!result.canceled) {
        const base64Data = result.assets[0].base64 || null;
        setPhoto(base64Data);
        console.log('Photo selected:', base64Data ? `Base64 data present, length: ${base64Data.length}` : 'No base64 data');
      }
    };

    const handleRegister = async () => {
      if (!name || !password || !phone || !email || !photo) {
        Alert.alert('Помилка', 'Заповніть усі поля, включаючи фото профілю.');
        return;
      }
      const isServerUp = await checkServer();
      if (!isServerUp) return;

      try {
        const formData = new FormData();
        formData.append('userName', name);
        formData.append('password', password);
        const blob = await (await fetch(`data:image/jpeg;base64,${photo}`)).blob();
        formData.append('profilePicture', blob, 'profile.jpg');

        console.log('Sending FormData:', {
          userName: name,
          password: password,
          profilePicture: `Blob size: ${blob.size} bytes`,
        });

        const response = await api.post('/user/register', formData);
        const { message } = response.data;
        Alert.alert('Успіх', message);

        const loginResponse = await api.post('/user/login', { userName: name, password }, {
          headers: { 'Content-Type': 'application/json' },
        });
        const { token } = loginResponse.data;
        await AsyncStorage.setItem('jwt_token', token);
        setToken(token);
        setUser({ name });
        setPage('products');
      } catch (error: any) {
        Alert.alert('Помилка', error.message || 'Реєстрація не вдалася.');
      }
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Реєстрація</Text>
          <TextInput
              style={styles.input}
              placeholder="Ім'я"
              value={name}
              onChangeText={setName}
          />
          <TextInput
              style={styles.input}
              placeholder="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
          />
          <TextInput
              style={styles.input}
              placeholder="Телефон"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
          />
          <TextInput
              style={styles.input}
              placeholder="Електронна пошта"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
          />
          <Button title="Обрати фото профілю (обов’язково)" onPress={pickImage} />
          {photo && <Image source={{ uri: `data:image/jpeg;base64,${photo}` }} style={styles.image} />}
          <Button title="Зареєструватися" onPress={handleRegister} />
          <Button title="Вже є аккаунт? Увійти" onPress={() => setPage('login')} />
        </ScrollView>
    );
  };

  const LoginPage: React.FC = () => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async () => {
      if (!name || !password) {
        Alert.alert('Помилка', 'Заповніть ім’я та пароль.');
        return;
      }
      const isServerUp = await checkServer();
      if (!isServerUp) return;

      try {
        const response = await api.post('/user/login', { userName: name, password }, {
          headers: { 'Content-Type': 'application/json' },
        });
        const { token } = response.data;
        await AsyncStorage.setItem('jwt_token', token);
        setToken(token);
        setUser({ name });
        setPage('products');
        Alert.alert('Успіх', 'Вхід успішний!');
      } catch (error: any) {
        Alert.alert('Помилка', error.message || 'Вхід не вдався.');
      }
    };

    return (
        <View style={styles.container}>
          <Text style={styles.title}>Вхід</Text>
          <TextInput
              style={styles.input}
              placeholder="Ім'я"
              value={name}
              onChangeText={setName}
          />
          <TextInput
              style={styles.input}
              placeholder="Пароль"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
          />
          <Button title="Увійти" onPress={handleLogin} />
          <Button title="Немає аккаунта? Зареєструватися" onPress={() => setPage('register')} />
        </View>
    );
  };

  const ProductsPage: React.FC = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [productName, setProductName] = useState('');
    const [description, setDescription] = useState('');
    const [price, setPrice] = useState('');
    const [productImage, setProductImage] = useState<string | null>(null);

    useEffect(() => {
      const fetchProducts = async () => {
        try {
          const response = await api.get('/product');
          setProducts(response.data);
        } catch (error) {
          Alert.alert('Помилка', 'Не вдалося отримати товари.');
        }
      };
      fetchProducts();
    }, []);

    const pickProductImage = async () => {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Дозвіл відхилено', 'Дозвольте доступ до фото.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        base64: true,
        quality: 0.3, // Зменшуємо якість
      });
      if (!result.canceled) {
        const base64Data = result.assets[0].base64 || null;
        setProductImage(base64Data);
        console.log('Product photo selected:', base64Data ? `Base64 data present, length: ${base64Data.length}` : 'No base64 data');
      }
    };

    const handleAddProduct = async () => {
      if (!productName || !description || !price) {
        Alert.alert('Помилка', 'Заповніть усі поля.');
        return;
      }
      const isServerUp = await checkServer();
      if (!isServerUp) return;

      try {
        const formData = new FormData();
        formData.append('name', productName);
        formData.append('description', description);
        formData.append('price', price);
        if (productImage) {
          const blob = await (await fetch(`data:image/jpeg;base64,${productImage}`)).blob();
          formData.append('image', blob, 'product.jpg');
          console.log('Sending product FormData:', {
            name: productName,
            description: description,
            price: price,
            image: `Blob size: ${blob.size} bytes`,
          });
        }
        await api.post('/product', formData);
        const response = await api.get('/product');
        setProducts(response.data);
        setProductName('');
        setDescription('');
        setPrice('');
        setProductImage(null);
        Alert.alert('Успіх', 'Товар додано!');
      } catch (error: any) {
        Alert.alert('Помилка', error.message || 'Не вдалося додати товар.');
      }
    };

    const renderProduct = ({ item }: { item: Product }) => (
        <View style={styles.productItem}>
          {item.image && <Image source={{ uri: `http://192.168.1.2:5259/${item.image}` }} style={styles.productImage} />}
          <Text style={styles.productText}>Назва: {item.name}</Text>
          <Text style={styles.productText}>Опис: {item.description}</Text>
          <Text style={styles.productText}>Ціна: ${item.price}</Text>
        </View>
    );

    return (
        <ScrollView contentContainerStyle={styles.container}>
          <Text style={styles.title}>Товари для {user?.name}</Text>
          <TextInput
              style={styles.input}
              placeholder="Назва товару"
              value={productName}
              onChangeText={setProductName}
          />
          <TextInput
              style={styles.input}
              placeholder="Опис"
              value={description}
              onChangeText={setDescription}
          />
          <TextInput
              style={styles.input}
              placeholder="Ціна"
              value={price}
              onChangeText={setPrice}
              keyboardType="numeric"
          />
          <Button title="Обрати фото товару" onPress={pickProductImage} />
          {productImage && <Image source={{ uri: `data:image/jpeg;base64,${productImage}` }} style={styles.image} />}
          <Button title="Додати товар" onPress={handleAddProduct} />
          <FlatList
              data={products}
              renderItem={renderProduct}
              keyExtractor={(item) => item.id}
              style={styles.productList}
          />
          <Button
              title="Вийти"
              onPress={async () => {
                try {
                  await api.post('/user/logout');
                  await AsyncStorage.removeItem('jwt_token');
                  setToken(null);
                  setUser(null);
                  setPage('login');
                } catch (error) {
                  console.error('Помилка виходу:', error);
                }
              }}
          />
        </ScrollView>
    );
  };

  return (
      <View style={styles.container}>
        {page === 'register' && <RegisterPage />}
        {page === 'login' && <LoginPage />}
        {page === 'products' && <ProductsPage />}
      </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
    backgroundColor: '#fff',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  input: {
    height: 40,
    borderColor: 'gray',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 10,
  },
  image: {
    width: 100,
    height: 100,
    marginVertical: 10,
    alignSelf: 'center',
  },
  productList: {
    marginTop: 20,
  },
  productItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
  },
  productImage: {
    width: 50,
    height: 50,
    marginBottom: 5,
  },
  productText: {
    fontSize: 16,
  },
});

export default App;