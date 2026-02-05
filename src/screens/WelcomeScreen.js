import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  FlatList,
  useWindowDimensions,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SIZES, FONTS } from '../utils/constants';

const slides = [
  {
    id: '1',
    title: 'Making Your Journey Easy',
    description: 'Welcome to JADA RIDE, the most convenient and reliable way to get around town',
    background: require('../../assets/welcome-ride.png'),
    buttonText: 'Request a Ride',
  },
  {
    id: '2',
    title: 'Making Your Journey Easy',
    description: 'Welcome to JADA RIDE, the most convenient and reliable way to get around town',
    background: require('../../assets/welcome-delivery.png'),
    buttonText: 'Request a Delivery',
  },
];

const WelcomeScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const scaleBase = Math.min(width / 375, height / 812);
  const scale = (value) => Math.round(value * scaleBase);
  const rideImageOffset = clamp(Math.round(height * -0.02), -32, -8);
  const deliveryImageOffset = clamp(Math.round(height * -0.06), -70, -24);
  const horizontalPadding = clamp(scale(SIZES.padding), 14, 28);
  const bottomPadding = clamp(scale(80), 56, 110);
  const cardPadding = clamp(scale(18), 14, 24);
  const cardRadius = clamp(scale(20), 16, 26);
  const cardMaxWidth = Math.min(Math.round(width * 0.92), 420);
  const titleSize = clamp(scale(FONTS.sizes.xlarge), 18, 26);
  const titleMarginBottom = clamp(scale(8), 6, 12);
  const descriptionSize = clamp(scale(FONTS.sizes.small), 12, 16);
  const descriptionLineHeight = clamp(scale(20), 16, 24);
  const descriptionMarginBottom = clamp(scale(12), 8, 16);
  const actionPaddingV = clamp(scale(6), 4, 8);
  const actionPaddingH = clamp(scale(14), 10, 18);
  const actionRadius = clamp(scale(14), 10, 18);
  const actionTextSize = clamp(scale(FONTS.sizes.small), 11, 15);
  const paginationMarginTop = clamp(scale(16), 10, 20);
  const dotSize = clamp(scale(8), 6, 10);
  const dotSpacing = clamp(scale(8), 6, 12);
  const dotActiveWidth = clamp(scale(20), 14, 26);
  const footerMarginTop = clamp(scale(18), 12, 24);
  const getStartedHeight = clamp(scale(SIZES.buttonHeight), 48, 64);
  const getStartedRadius = clamp(scale(28), 22, 32);
  const getStartedTextSize = clamp(scale(FONTS.sizes.regular), 14, 18);
  const getStartedArrowSize = clamp(scale(18), 14, 22);
  const getStartedArrowMargin = clamp(scale(10), 6, 14);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const flatListRef = React.useRef(null);

  React.useEffect(() => {
    const interval = setInterval(() => {
      setActiveIndex((prevIndex) => {
        const nextIndex = (prevIndex + 1) % slides.length;
        flatListRef.current?.scrollToOffset({
          offset: nextIndex * width,
          animated: true,
        });
        return nextIndex;
      });
    }, 4000);

    return () => clearInterval(interval);
  }, [width]);

  const handleScrollEnd = (event) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const index = Math.round(offsetX / width);
    setActiveIndex(index);
  };

  const renderPagination = () => (
    <View style={[styles.pagination, { marginTop: paginationMarginTop }]}>
      {slides.map((slide, index) => (
        <View
          key={slide.id}
          style={[
            styles.paginationDot,
            {
              width: dotSize,
              height: dotSize,
              borderRadius: dotSize / 2,
              marginRight: dotSpacing,
            },
            index === activeIndex && [styles.paginationDotActive, { width: dotActiveWidth }],
          ]}
        />
      ))}
    </View>
  );

  const renderSlide = ({ item, index }) => {
    const imageOffsetY = item.id === '2' ? deliveryImageOffset : rideImageOffset;

    return (
    <ImageBackground
      source={item.background}
      style={[styles.slide, { width, paddingHorizontal: horizontalPadding, paddingBottom: bottomPadding }]}
      imageStyle={[styles.slideImage, { transform: [{ translateY: imageOffsetY }] }]}
    >
      <View style={styles.slideContent}>
        <View style={[styles.contentCard, { padding: cardPadding, borderRadius: cardRadius, maxWidth: cardMaxWidth }]}>
          <Text style={[styles.title, { fontSize: titleSize, marginBottom: titleMarginBottom }]}>
            Making Your <Text style={styles.highlight}>Journey</Text> Easy
          </Text>
          <Text
            style={[
              styles.description,
              {
                fontSize: descriptionSize,
                lineHeight: descriptionLineHeight,
                marginBottom: descriptionMarginBottom,
              },
            ]}
          >
            {item.description}
          </Text>

          <TouchableOpacity
            style={[
              styles.actionButton,
              { paddingVertical: actionPaddingV, paddingHorizontal: actionPaddingH, borderRadius: actionRadius },
            ]}
          >
            <Text style={[styles.actionButtonText, { fontSize: actionTextSize }]}>
              {item.buttonText}
            </Text>
          </TouchableOpacity>
        </View>

        {renderPagination()}
      </View>

      {index === slides.length - 1 && (
        <View style={[styles.footer, { marginTop: footerMarginTop }]}>
          <TouchableOpacity
            style={[styles.getStartedButton, { height: getStartedHeight, borderRadius: getStartedRadius }]}
            onPress={() => navigation.navigate('PhoneInput')}
            activeOpacity={0.8}
          >
            <Text style={[styles.getStartedText, { fontSize: getStartedTextSize }]}>Get started</Text>
            <Text
              style={[
                styles.getStartedArrow,
                { fontSize: getStartedArrowSize, marginLeft: getStartedArrowMargin },
              ]}
            >
              →
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </ImageBackground>
  );
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        ref={flatListRef}
        data={slides}
        renderItem={renderSlide}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleScrollEnd}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slide: {
    flex: 1,
    paddingHorizontal: SIZES.padding,
    justifyContent: 'flex-end',
    paddingBottom: 80,
  },
  slideImage: {
    resizeMode: 'contain',
  },
  slideContent: {
    width: '100%',
  },
  contentCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 20,
    padding: 18,
    alignSelf: 'flex-start',
    maxWidth: '92%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  title: {
    fontSize: FONTS.sizes.xlarge,
    fontWeight: 'bold',
    color: COLORS.teal,
    textAlign: 'left',
    marginBottom: 8,
  },
  highlight: {
    color: COLORS.orange,
  },
  description: {
    fontSize: FONTS.sizes.small,
    color: COLORS.textSecondary,
    textAlign: 'left',
    lineHeight: 20,
    marginBottom: 12,
  },
  actionButton: {
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.orange,
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  actionButtonText: {
    fontSize: FONTS.sizes.small,
    color: COLORS.orange,
    fontWeight: '700',
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  paginationDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(20, 71, 64, 0.2)',
    marginRight: 8,
  },
  paginationDotActive: {
    width: 20,
    backgroundColor: COLORS.teal,
  },
  footer: {
    marginTop: 18,
  },
  getStartedButton: {
    width: '100%',
    backgroundColor: COLORS.teal,
    borderRadius: 28,
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  getStartedText: {
    color: COLORS.white,
    fontSize: FONTS.sizes.regular,
    fontWeight: '700',
  },
  getStartedArrow: {
    color: COLORS.white,
    fontSize: 18,
    marginLeft: 10,
    marginTop: 1,
  },
});

export default WelcomeScreen;
