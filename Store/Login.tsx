import React, { useState } from 'react';
import { View, Text, TextInput, Button, StyleSheet, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

interface LoginProps {
    setPage: (page: 'login' | 'products' | 'register' | 'profile') => void;
    setToken: (token: string | null) => void;
    setUser: (user: { name: string; profilePicture?: string; phoneNumber?: string; email?: string } | null) => void;
}

const Login: React.FC<LoginProps> = ({ setPage, setToken, setUser }) => {
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isLoggingIn, setIsLoggingIn] = useState(false);

    const handleLogin = async () => {
        if (isLoggingIn) return;
        if (!name || !password) {
            Alert.alert('Помилка', 'Заповніть ім’я та пароль.');
            return;
        }
        const isServerUp = await checkServer();
        if (!isServerUp) return;

        setIsLoggingIn(true);
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
            if (!token) {
                throw new Error('Токен не отриманий від сервера');
            }

            await AsyncStorage.setItem('jwt_token', token);
            setToken(token);

            const userResponse = await api.get('/user/profile');
            setUser({
                name: userResponse.data.userName,
                profilePicture: userResponse.data.profilePicture,
                phoneNumber: userResponse.data.phoneNumber,
                email: userResponse.data.email,
            });
            setPage('products');
            Alert.alert('Успіх', 'Вхід успішний!');
        } catch (error) {
            console.error('Login error details:', (error as Error).message);
            Alert.alert('Помилка', (error as Error).message || 'Вхід не вдався.');
            if ((error as any).response?.status === 401) {
                Alert.alert('Помилка авторизації', 'Неправильне ім’я користувача або пароль.');
            }
        } finally {
            setIsLoggingIn(false);
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
            <View style={styles.buttonRow}>
                <View style={styles.button}>
                    <Button title="Увійти" onPress={handleLogin} disabled={isLoggingIn} />
                </View>
                <View style={styles.button}>
                    <Button title="Немає аккаунта? Зареєструватися" onPress={() => setPage('register')} />
                </View>
            </View>
            <View style={styles.buttonRow}>
                <View style={styles.button}>
                    <Button title="Назад" onPress={() => setPage('register')} color="blue" />
                </View>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
        backgroundColor: '#fff',
        justifyContent: 'center',
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

export default Login;