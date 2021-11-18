export default /* glsl */`
#if defined( RE_IndirectDiffuse )

	#ifdef USE_LIGHTMAP

		vec4 lightMapTexel= texture2D( lightMap, vUv2 );
		vec3 lightMapIrradiance = lightMapTexelToLinear( lightMapTexel ).rgb * lightMapIntensity;

		#ifndef PHYSICALLY_CORRECT_LIGHTS

			lightMapIrradiance *= PI; // factor of PI should not be present; included here to prevent breakage

		#endif

		irradiance += lightMapIrradiance;

	#endif

	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )

		iblIrradiance += getLightProbeIndirectIrradiance( /*lightProbe,*/ splitGeoNormal, maxMipLevel );

	#endif

#endif

#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )

	#ifdef ENVMAP_MODE_REFLECTION

		radiance += getLightProbeIndirectRadianceReflection( /*specularLightProbe,*/ geometry.viewDir, splitGeoNormal, material.specularRoughness, maxMipLevel );
		radianceRefraction += getLightProbeIndirectRadianceRefraction( /*specularLightProbe,*/ geometry.viewDir, splitGeoNormal, material.specularRoughness, maxMipLevel );

	#else

		radiance += getLightProbeIndirectRadianceRefraction( /*specularLightProbe,*/ geometry.viewDir, splitGeoNormal, material.specularRoughness, maxMipLevel );

	#endif

	#ifdef CLEARCOAT

		#ifdef ENVMAP_MODE_REFLECTION

			clearcoatRadiance += getLightProbeIndirectRadianceReflection( /*specularLightProbe,*/ geometry.viewDir, splitGeoClearcoatNormal, material.clearcoatRoughness, maxMipLevel );

		#else

			clearcoatRadiance += getLightProbeIndirectRadianceRefraction( /*specularLightProbe,*/ geometry.viewDir, splitGeoClearcoatNormal, material.clearcoatRoughness, maxMipLevel );

		#endif

	#endif

#endif
`;
