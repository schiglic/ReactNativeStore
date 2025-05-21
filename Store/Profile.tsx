import React, { useState } from 'react';
import { View, Text, TextInput, Button, Image, StyleSheet, Alert, ScrollView } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import api from './api';

interface User {
    name: string;
    profilePicture?: string;
    phoneNumber?: string;
    email?: string;
}

interface ProfileProps {
    user: User;
    onUpdate: (updatedUser: User) => void;
    onLogout: () => void;
    setPage: (page: 'login' | 'products' | 'register' | 'profile') => void;
}

const Profile: React.FC<ProfileProps> = ({ user, onUpdate, onLogout, setPage }) => {
    const [phone, setPhone] = useState(user.phoneNumber || '');
    const [email, setEmail] = useState(user.email || '');
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [newProfileImage, setNewProfileImage] = useState<string | null>(null);

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
            setNewProfileImage(base64Data);
            console.log('Profile photo selected:', base64Data ? `Base64 length: ${base64Data.length}` : 'No base64 data');
        }
    };

    const handleUpdateProfile = async () => {
        const isServerUp = await checkServer();
        if (!isServerUp) return;

        try {
            const formData = new FormData();
            formData.append('PhoneNumber', phone || '');
            formData.append('Email', email || '');
            if (oldPassword && newPassword) {
                formData.append('OldPassword', oldPassword);
                formData.append('NewPassword', newPassword);
            }
            if (newProfileImage) formData.append('ProfilePictureBase64', newProfileImage);

            console.log('Sending Profile Update FormData:', {
                PhoneNumber: phone,
                Email: email,
                OldPassword: oldPassword ? '***' : null,
                NewPassword: newPassword ? '***' : null,
                ProfilePictureBase64: newProfileImage ? `Base64 length: ${newProfileImage.length}` : null,
            });

            const response = await api.put('/user/profile', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const { message } = response.data;
            Alert.alert('Успіх', message);

            const userResponse = await api.get('/user/profile');
            onUpdate({
                name: user.name,
                profilePicture: userResponse.data.profilePicture,
                phoneNumber: userResponse.data.phoneNumber,
                email: userResponse.data.email,
            });
            setOldPassword('');
            setNewPassword('');
            setNewProfileImage(null);
        } catch (error) {
            console.error('Profile update error details:', (error as Error).message);
            Alert.alert('Помилка', (error as Error).message || 'Не вдалося оновити профіль.');
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

    const handleCancel = () => {
        setPhone(user.phoneNumber || '');
        setEmail(user.email || '');
        setOldPassword('');
        setNewPassword('');
        setNewProfileImage(null);
        setPage('products');
    };

    return (
        <ScrollView contentContainerStyle={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>Профіль: {user.name}</Text>
                {user.profilePicture && (
                    <Image
                        source={{ uri: `http://192.168.1.2:5259/${user.profilePicture}` }}
                        style={styles.profileImage}
                        onError={(e) => console.log('Profile image load error:', e.nativeEvent.error)}
                    />
                )}
            </View>
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
            <TextInput
                style={styles.input}
                placeholder="Старий пароль"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
            />
            <TextInput
                style={styles.input}
                placeholder="Новий пароль"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
            />
            <Button title="Обрати нову аватарку" onPress={pickImage} />
            {newProfileImage && <Image source={{ uri: `data:image/jpeg;base64,${newProfileImage}` }} style={styles.image} />}
            <View style={styles.buttonRow}>
                <View style={styles.button}>
                    <Button title="Оновити профіль" onPress={handleUpdateProfile} />
                </View>
                <View style={styles.button}>
                    <Button title="Скасувати" onPress={handleCancel} color="gray" />
                </View>
            </View>
            <View style={styles.buttonRow}>
                <View style={styles.button}>
                    <Button title="Назад" onPress={() => setPage('products')} color="blue" />
                </View>
                <View style={styles.button}>
                    <Button title="Вийти" onPress={onLogout} color="red" />
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
    header: {
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 10,
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

export default Profile;