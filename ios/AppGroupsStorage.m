/**
 * AppGroupsStorage - Native Module Bridge
 * 
 * Objective-C bridge for React Native.
 */

#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(AppGroupsStorage, NSObject)

RCT_EXTERN_METHOD(setValue:(NSString *)value forKey:(NSString *)key)

RCT_EXTERN_METHOD(getValue:(NSString *)key
                  resolver:(RCTPromiseResolveBlock)resolver
                  rejecter:(RCTPromiseRejectBlock)rejecter)

RCT_EXTERN_METHOD(removeValue:(NSString *)key)

RCT_EXTERN_METHOD(clearAll)

@end
