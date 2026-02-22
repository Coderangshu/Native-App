import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Button, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { YStack } from 'tamagui';

export default function CameraScreen() {
    const [permission, requestPermission] = useCameraPermissions();
    const cameraRef = useRef<CameraView>(null);
    const router = useRouter();
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        if (permission && !permission.granted && !permission.canAskAgain) {
            // Permission denied and cannot ask again.
            // Maybe show a link to settings?
        } else if (!permission?.granted) {
            requestPermission();
        }
    }, [permission]);

    if (!permission) {
        // Camera permissions are still loading.
        return <View />;
    }

    if (!permission.granted) {
        return (
            <YStack flex={1} justifyContent="center" alignItems="center" padding="$4" backgroundColor="black">
                <Text style={{ textAlign: 'center', marginBottom: 20, color: 'white' }}>
                    Camera permission is required. Please enable it in settings.
                </Text>
                <Button onPress={requestPermission} title="Try Again" />
            </YStack>
        );
    }

    const takePicture = async () => {
        if (cameraRef.current) {
            setIsProcessing(true);
            try {
                const photo = await cameraRef.current.takePictureAsync({
                    quality: 0.5,
                    base64: true, // we need base64 for the API if we aren't reading from file on web
                });

                // On web, photo.uri might be a blob or base64 data uri.
                // Log screen expects uri.
                // If we passed base64, we should use it.
                // Our current logic in Log screen reads file from URI using expo-file-system.
                // expo-file-system DOES NOT work on web for file:// URIs usually.
                // We might need to pass base64 directly to Log screen for web support.

                router.push({
                    pathname: '/log',
                    params: {
                        imageUri: photo.uri
                    }
                });
            } catch (e) {
                console.error(e);
            } finally {
                setIsProcessing(false);
            }
        }
    };

    return (
        <View style={styles.container}>
            <CameraView style={styles.camera} facing="back" ref={cameraRef}>
                <View style={styles.buttonContainer}>
                    <TouchableOpacity style={styles.button} onPress={takePicture} disabled={isProcessing}>
                        <View style={{ width: 70, height: 70, borderRadius: 35, backgroundColor: 'white', opacity: isProcessing ? 0.5 : 1 }} />
                    </TouchableOpacity>
                </View>
            </CameraView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
    },
    camera: {
        flex: 1,
    },
    buttonContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'transparent',
        margin: 64,
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    button: {
        alignSelf: 'flex-end',
        alignItems: 'center',
    },
});
