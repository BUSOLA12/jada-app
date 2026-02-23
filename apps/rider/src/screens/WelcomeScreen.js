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
import ArrowRight from '../../assets/arrow-right.svg';
import JadaLogo from '../../assets/Jada-logo2.svg';

const slides = [
  {
    id: '1',
    title: 'Making Your Journey Easy',
    description: 'Welcome to JADA RIDE, the most convenient and reliable way to get around town.',
    background: require('../../assets/welcome-journey.png'),
    imageKind: 'ride',
    buttonText: 'Request a Ride',
  },
  {
    id: '2',
    title: 'Convenient Tricycles',
    description: 'Need a quick trip? Our tricycles offer a convenient and affordable way to navigate through traffic and reach your destination faster.',
    background: require('../../assets/welcome-tricycle.png'),
    imageKind: 'tricycle',
    buttonText: 'Request a Tricycle',
  },
  {
    id: '3',
    title: 'Affordable Luxury',
    description: 'Enjoy a premium ride without the premium price tag. Our officials cars offer the perfect balance of comfort and affordability for your business and personal trips.',
    background: require('../../assets/welcome-luxury.png'),
    imageKind: 'luxury',
    buttonText: 'Book a Ride',
  },
  {
    id: '4',
    title: 'Safety First, Always',
    description: 'Your safety is our top priority. With trusted drivers, verified routes, and real-time tracking, you can ride with confidence every time. Every ride is protected with advanced security features.',
    background: require('../../assets/welcome-safety.png'),
    imageKind: 'safety',
    buttonText: 'Book a Ride',
  },
  {
    id: '5',
    title: '24/7 Support, Always Here for You',
    description: 'Our dedicated support team is available around the clock to assist you with any questions or concerns. Whether you need help with a booking, have a question about our services, or require assistance during your ride, we are here to ensure you have a smooth and enjoyable experience.',
    background: require('../../assets/welcome-support.png'),
    imageKind: 'support',
    buttonText: 'Start Riding',
  },
];

const WelcomeScreen = ({ navigation }) => {
  const { width, height } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [sliderHeight, setSliderHeight] = React.useState(Math.round(height * 0.72));
  const flatListRef = React.useRef(null);

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const scaleBase = Math.min(width / 375, height / 812);
  const scale = (value) => Math.round(value * scaleBase);

  const slideViewportHeight = Math.max(320, sliderHeight);
  const rideImageOffset = clamp(Math.round(slideViewportHeight * -0.06), -86, -20);
  const tricycleImageOffset = clamp(Math.round(slideViewportHeight * -0.11), -140, -50);
  const safetyImageOffset = clamp(Math.round(slideViewportHeight * -0.13), -170, -62);
  const supportImageOffset = clamp(Math.round(slideViewportHeight * -0.13), -170, -62);
  const deliveryImageOffset = clamp(Math.round(slideViewportHeight * -0.09), -120, -40);
  const horizontalPadding = clamp(scale(SIZES.padding), 14, 28);
  const bottomPadding = clamp(Math.round(slideViewportHeight * 0.08), 24, 58);
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
  const footerPaddingBottom = clamp(scale(10), 8, 18);
  const logoWidth = clamp(scale(178), 130, 230);
  const logoHeight = clamp(Math.round(logoWidth * 0.3), 24, 58);
  const logoTop = clamp(scale(10), 6, 16);
  const logoTopOffset = clamp(scale(16), 10, 24);
  const logoRightInset = clamp(scale(-30), -54, -24);
  const getStartedHeight = clamp(scale(SIZES.buttonHeight), 48, 64);
  const getStartedTextSize = clamp(scale(FONTS.sizes.regular), 14, 18);
  const getStartedArrowSize = clamp(scale(20), 14, 24);
  const getStartedArrowMargin = clamp(scale(10), 6, 14);
  const accountButtonHeight = Math.max(46, getStartedHeight - 4);
  const footerButtonRadius = 12;
  const accountTextSize = clamp(scale(FONTS.sizes.medium), 12, 16);

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

  const handleSliderLayout = React.useCallback((event) => {
    const nextHeight = Math.round(event.nativeEvent.layout.height);
    setSliderHeight((prevHeight) => (Math.abs(prevHeight - nextHeight) > 1 ? nextHeight : prevHeight));
  }, []);

  const getItemLayout = React.useCallback(
    (_, index) => ({
      length: width,
      offset: width * index,
      index,
    }),
    [width]
  );

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

  const renderSlide = ({ item }) => {
    const imageOffsetY =
      item.imageKind === 'delivery'
        ? deliveryImageOffset
        : item.imageKind === 'safety'
          ? safetyImageOffset
        : item.imageKind === 'support'
          ? supportImageOffset
        : item.imageKind === 'tricycle'
          ? tricycleImageOffset
          : rideImageOffset;
    const imageScale = item.id === '1' || item.id === '3' ? 1.06 : 1;

    return (
      <ImageBackground
        source={item.background}
        style={[styles.slide, { width, paddingHorizontal: horizontalPadding, paddingBottom: bottomPadding }]}
        imageStyle={[styles.slideImage, { transform: [{ translateY: imageOffsetY }, { scale: imageScale }] }]}
      >
        <View style={styles.slideContent}>
          <View style={[styles.contentCard, { padding: cardPadding, borderRadius: cardRadius, maxWidth: cardMaxWidth }]}>
            <Text style={[styles.title, { fontSize: titleSize, marginBottom: titleMarginBottom }]}>
              {item.title}
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
      </ImageBackground>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View
        pointerEvents="none"
        style={[
          styles.slideLogoContainer,
          {
            top: logoTop + logoTopOffset,
            right: logoRightInset,
          },
        ]}
      >
        <JadaLogo width={logoWidth} height={logoHeight} />
      </View>

      <View style={styles.sliderArea} onLayout={handleSliderLayout}>
        <FlatList
          ref={flatListRef}
          data={slides}
          renderItem={renderSlide}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          keyExtractor={(item) => item.id}
          onMomentumScrollEnd={handleScrollEnd}
          getItemLayout={getItemLayout}
          initialNumToRender={1}
          maxToRenderPerBatch={1}
          windowSize={2}
          removeClippedSubviews
        />
      </View>

      <View
        style={[
          styles.footer,
          {
            marginTop: footerMarginTop,
            paddingHorizontal: horizontalPadding,
            paddingBottom: footerPaddingBottom,
          },
        ]}
      >
        <TouchableOpacity
          style={[styles.getStartedButton, { height: accountButtonHeight, borderRadius: footerButtonRadius }]}
          onPress={() => navigation.navigate('PhoneInput')}
          activeOpacity={0.8}
        >
          <Text style={[styles.getStartedText, { fontSize: getStartedTextSize }]}>Get started</Text>
          <View style={[styles.getStartedArrowIconWrap, { marginLeft: getStartedArrowMargin }]}>
            <ArrowRight width={getStartedArrowSize} height={Math.round(getStartedArrowSize * 0.62)} />
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.alreadyAccountButton, { height: accountButtonHeight, borderRadius: footerButtonRadius }]}
          onPress={() => navigation.navigate('PhoneInput')}
          activeOpacity={0.8}
        >
          <Text
            style={[styles.alreadyAccountText, { fontSize: accountTextSize }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.85}
          >
            Already have an account
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  slideLogoContainer: {
    position: 'absolute',
    zIndex: 30,
    elevation: 30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderArea: {
    flex: 1,
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
    width: '100%',
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
  getStartedArrowIconWrap: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  alreadyAccountButton: {
    width: '100%',
    backgroundColor: 'transparent',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.teal,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 10,
  },
  alreadyAccountText: {
    color: COLORS.teal,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: 8,
  },
});

export default WelcomeScreen;
