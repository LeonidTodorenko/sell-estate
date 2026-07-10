import React from 'react';
import {
    View,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';

import theme from '../constants/theme';

export default function ScreenLoader() {
    return (
        <View style={styles.container}>
            <ActivityIndicator
                size="large"
                color={theme.colors.primary}
            />
        </View>
    );
}

const styles = StyleSheet.create({

    container:{

        flex:1,

        justifyContent:'center',

        alignItems:'center',

        backgroundColor:theme.colors.background

    }

});