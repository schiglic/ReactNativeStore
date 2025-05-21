import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Image, FlatList, StyleSheet, Alert, ScrollView } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import axios, { AxiosError } from 'axios';

// Налаштування Axios для бекенду
const api = axios.create({
    baseURL: 'http://192.168.1.2:5259/api',
    headers: { 'Content-Type': 'multipart/form-data' },
    timeout: 15000,
});

// Дебаг-записи
api.interceptors.request.use(
    request => {
        console.log('Request:', request.method, request.url, 'Data:', request.data);
        return request;
    },
    error => {
        console.error('Request error:', (error as Error).message);
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    response => {
        console.log('Response:', response.status, 'Data:', response.data);
        return response;
    },
    error => {
        const axiosError = error as AxiosError;
        console.error('Response error:', axiosError.message, 'Code:', axiosError.code);
        if (axiosError.code === 'ECONNABORTED') {
            console.error('Timeout: Сервер не відповів протягом 15 секунд');
        } else if (axiosError.code === 'ERR_NETWORK') {
            console.error('Network error details:', axiosError.config?.url);
        }
        return Promise.reject(error);
    }
);

interface User {
    name: string;
    profilePicture?: string;
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
                    api.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
                    setPage('products');
                }
            } catch (error) {
                console.error('Помилка перевірки токена:', (error as Error).message);
            }
        };
        checkToken();
    }, []);

    const checkServer = async () => {
        try {
            console.log('Перевірка доступності сервера...');
            const response = await api.get('/ping');
            console.log('Сервер доступний! Відповідь:', response.data);
            return true;
        } catch (error) {
            const axiosError = error as AxiosError;
            console.error('Server check failed:', axiosError.message);
            Alert.alert('Помилка мережі', `Не вдалося підключитися до сервера. Перевір IP, порт або брандмауер.\nДеталі: ${axiosError.message}`);
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
                quality: 0.2,
            });
            if (!result.canceled) {
                const base64Data = result.assets[0].base64 || null;
                setPhoto(base64Data);
                console.log('Photo selected:', base64Data ? `Base64 length: ${base64Data.length}` : 'No base64 data');
            }
        };

        const handleRegister = async () => {
            if (!name || !password || !phone || !email) {
                Alert.alert('Помилка', 'Заповніть ім’я, пароль, телефон і email.');
                return;
            }
            if (!photo) {
                Alert.alert('Помилка', 'Оберіть фото профілю (обов’язково).');
                return;
            }
            const isServerUp = await checkServer();
            if (!isServerUp) return;

            try {
                const formData = new FormData();
                formData.append('UserName', name);
                formData.append('Password', password);
                formData.append('PhoneNumber', phone);
                formData.append('Email', email);
                formData.append('ProfilePictureBase64', photo);

                console.log('Sending FormData:', {
                    UserName: name,
                    Password: password,
                    PhoneNumber: phone,
                    Email: email,
                    ProfilePictureBase64: `Base64 length: ${photo.length}`,
                });

                console.log('Final FormData prepared, sending to /user/register');
                const response = await api.post('/user/register', formData);
                const { message } = response.data;
                Alert.alert('Успіх', message);

                const loginFormData = new FormData();
                loginFormData.append('UserName', name);
                loginFormData.append('Password', password);
                const loginResponse = await api.post('/user/login', loginFormData);
                const { token } = loginResponse.data;
                await AsyncStorage.setItem('jwt_token', token);
                setToken(token);
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                setUser({ name, profilePicture: photo }); // Зберігаємо ім'я та фото користувача
                setPage('products');
            } catch (error) {
                const axiosError = error as AxiosError;
                console.error('Registration error details:', axiosError);
                Alert.alert('Помилка', axiosError.message || 'Реєстрація не вдалася.');
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
                const formData = new FormData();
                formData.append('UserName', name);
                formData.append('Password', password);

                console.log('Sending Login FormData:', {
                    UserName: name,
                    Password: password,
                });

                const response = await api.post('/user/login', formData);
                const { token } = response.data;
                await AsyncStorage.setItem('jwt_token', token);
                setToken(token);
                api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
                const userResponse = await api.get('/user/profile'); // Отримання профілю користувача
                setUser({ name, profilePicture: userResponse.data.profilePicture });
                setPage('products');
                Alert.alert('Успіх', 'Вхід успішний!');
            } catch (error) {
                const axiosError = error as AxiosError;
                console.error('Login error details:', axiosError);
                Alert.alert('Помилка', axiosError.message || 'Вхід не вдався.');
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

        const fetchProducts = async () => {
            try {
                const response = await api.get('/product');
                setProducts(response.data);
            } catch (error) {
                console.error('Помилка отримання продуктів:', (error as Error).message);
                Alert.alert('Помилка', 'Не вдалося отримати товари.');
            }
        };

        useEffect(() => {
            if (token) {
                fetchProducts();
            }
        }, [token]);

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
                quality: 0.2,
            });
            if (!result.canceled) {
                const base64Data = result.assets[0].base64 || null;
                setProductImage(base64Data);
                console.log('Product photo selected:', base64Data ? `Base64 length: ${base64Data.length}` : 'No base64 data');
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
                    formData.append('ImageBase64', productImage);
                    console.log('Sending product FormData:', {
                        name: productName,
                        description: description,
                        price: price,
                        ImageBase64: `Base64 length: ${productImage.length}`,
                    });
                }
                await api.post('/product', formData);
                await fetchProducts();
                setProductName('');
                setDescription('');
                setPrice('');
                setProductImage(null);
                Alert.alert('Успіх', 'Товар додано!');
            } catch (error) {
                const axiosError = error as AxiosError;
                console.error('Product add error details:', axiosError);
                Alert.alert('Помилка', axiosError.message || 'Не вдалося додати товар.');
            }
        };

        const renderProduct = ({ item }: { item: Product }) => (
            <View style={styles.productItem}>
                {item.image && (
                    <Image
                        source={{ uri: `http://192.168.1.2:5259/${item.image}` }}
                        style={styles.productImage}
                        onError={(e) => console.log('Image load error:', e.nativeEvent.error)}
                    />
                )}
                <Text style={styles.productText}>Назва: {item.name}</Text>
                <Text style={styles.productText}>Опис: {item.description}</Text>
                <Text style={styles.productText}>Ціна: ${item.price}</Text>
            </View>
        );

        return (
            <View style={styles.container}>
                <Text style={styles.title}>Профіль: {user?.name}</Text>
                {user?.profilePicture && (
                    <Image
                        source={{ uri: `http://192.168.1.2:5259/${user.profilePicture}` }}
                        style={styles.profileImage}
                        onError={(e) => console.log('Profile image load error:', e.nativeEvent.error)}
                    />
                )}
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
                            api.defaults.headers.common['Authorization'] = '';
                            setUser(null);
                            setPage('login');
                        } catch (error) {
                            console.error('Logout error:', (error as Error).message);
                        }
                    }}
                />
            </View>
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
        flex: 1,
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
    profileImage: {
        width: 100,
        height: 100,
        marginVertical: 10,
        alignSelf: 'center',
        borderRadius: 50,
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