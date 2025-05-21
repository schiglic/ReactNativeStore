import React, { useState } from 'react';
import { View, Text, TextInput, Button, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

interface RegisterProps {
    setPage: (page: 'login' | 'products' | 'register' | 'profile') => void;
    setToken: (token: string | null) => void;
    setUser: (user: { name: string; profilePicture?: string; phoneNumber?: string; email?: string } | null) => void;
}

const Register: React.FC<RegisterProps> = ({ setPage, setToken, setUser }) => {
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

            // Додаємо затримку для синхронізації AsyncStorage
            await new Promise(resolve => setTimeout(resolve, 100));

            const userResponse = await api.get('/user/profile');
            setUser({
                name: userResponse.data.userName,
                profilePicture: userResponse.data.profilePicture,
                phoneNumber: userResponse.data.phoneNumber,
                email: userResponse.data.email,
            });
            setPage('products');
        } catch (error) {
            console.error('Registration error details:', (error as Error).message);
            Alert.alert('Помилка', (error as Error).message || 'Реєстрація не вдалася.');
            if ((error as any).response?.status === 401) {
                Alert.alert('Помилка авторизації', 'Сесія закінчилася. Увійдіть знову.');
                setPage('login');
            }
        }
    };

    const checkServer = async () => {
        try {
            console.log('Перевірка доступності сервера...');
            const response = await api.get('/ping');
            console.log('Сервер доступний! Відповідь:', response.data);
            return true;
        } catch (error) {
            console.error('Server check failed:', (error as Error).message);
            Alert.alert('Помилка мережі', `Не вдалося підключитися до сервера. Перевір IP, порт або брандмауер.\nДеталі: ${(error as Error).message}`);
            return false;
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
            <View style={styles.buttonRow}>
                <View style={styles.button}>
                    <Button title="Зареєструватися" onPress={handleRegister} />
                </View>
                <View style={styles.button}>
                    <Button title="Вже є аккаунт? Увійти" onPress={() => setPage('login')} />
                </View>
            </View>
            <View style={styles.buttonRow}>
                <View style={styles.button}>
                    <Button title="Назад" onPress={() => setPage('login')} color="blue" />
                </View>
            </View>
        </ScrollView>
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
    buttonRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
    },
    button: {
        flex: 1,
        marginHorizontal: 5,
    },
});

export default Register;