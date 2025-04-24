declare module 'react-native-snap-carousel' {
  import { Component } from 'react';
  import { ViewStyle, StyleProp } from 'react-native';

  export interface CarouselProps<T> {
    data: T[];
    renderItem: (item: { item: T; index: number }) => JSX.Element;
    sliderWidth: number;
    itemWidth: number;
    onSnapToItem?: (index: number) => void;
    containerCustomStyle?: StyleProp<ViewStyle>;
    contentContainerCustomStyle?: StyleProp<ViewStyle>;
    loop?: boolean;
    autoplay?: boolean;
  }

  export default class Carousel<T> extends Component<CarouselProps<T>> {}
}
